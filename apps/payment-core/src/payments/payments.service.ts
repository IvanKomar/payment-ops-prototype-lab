import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type {
  PaymentCoreAuthResponse,
  PaymentCoreCreatePaymentResponse,
  PaymentCoreHistoryResponse,
  PaymentCoreStatus
} from "@payment-ops/shared-types";
import type { Payment, PaymentUser, Prisma } from "@prisma/client";
import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { loadPaymentCoreConfig } from "../config/payment-core.config.js";
import { assertPaymentTransition, initialStatusForScenario } from "./payment-state.js";
import type { CreatePaymentInput, LoginInput, RegisterInput } from "./dto/payment.schemas.js";
import {
  toAccountResponse,
  toPaymentEventResponse,
  toPaymentResponse,
  toUserResponse,
  type AuthenticatedPaymentUser
} from "./payments.types.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PaymentsService {
  private readonly config = loadPaymentCoreConfig();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(input: RegisterInput): Promise<PaymentCoreAuthResponse> {
    const existing = await this.prisma.paymentUser.findUnique({
      where: {
        brandId_email: {
          brandId: input.brandId,
          email: input.email
        }
      }
    });

    if (existing) {
      throw new ConflictException("User already exists for this brand");
    }

    const userId = `usr_${randomId()}`;
    const accountId = `acct_${randomId()}`;
    const passwordHash = hashPassword(input.password);

    const { user, account } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.paymentUser.create({
        data: {
          id: userId,
          brandId: input.brandId,
          email: input.email,
          passwordHash,
          displayName: input.displayName ?? displayNameFromEmail(input.email)
        }
      });
      const account = await tx.paymentAccount.create({
        data: {
          id: accountId,
          brandId: input.brandId,
          userId,
          balance: 0,
          currency: input.currency.toUpperCase()
        }
      });

      return { user, account };
    });
    const sessionToken = await this.createSession(user);

    return {
      sessionToken,
      user: toUserResponse(user),
      account: toAccountResponse(account)
    };
  }

  async login(input: LoginInput): Promise<PaymentCoreAuthResponse> {
    const user = await this.prisma.paymentUser.findUnique({
      where: {
        brandId_email: {
          brandId: input.brandId,
          email: input.email
        }
      },
      include: {
        accounts: {
          orderBy: {
            createdAt: "asc"
          },
          take: 1
        }
      }
    });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid brand, email, or password");
    }

    const account = user.accounts[0];

    if (!account) {
      throw new UnauthorizedException("User account is missing");
    }

    const sessionToken = await this.createSession(user);

    return {
      sessionToken,
      user: toUserResponse(user),
      account: toAccountResponse(account)
    };
  }

  async me(sessionToken: string): Promise<PaymentCoreAuthResponse> {
    const { user, account } = await this.authenticate(sessionToken);

    return {
      sessionToken,
      user: toUserResponse(user),
      account: toAccountResponse(account)
    };
  }

  async history(sessionToken: string): Promise<PaymentCoreHistoryResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const payments = await this.prisma.payment.findMany({
      where: {
        brandId: user.brandId,
        accountId: account.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    return {
      account: toAccountResponse(account),
      payments: payments.map(toPaymentResponse)
    };
  }

  async createPayment(
    sessionToken: string,
    input: CreatePaymentInput
  ): Promise<PaymentCoreCreatePaymentResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const paymentId = `pay_${randomId()}`;
    const status = initialStatusForScenario({
      paymentId,
      destinationLabel: input.destinationLabel,
      ...(input.scenario ? { scenario: input.scenario } : {})
    });
    const now = new Date();
    const timestamps = timestampsFor(status, now);
    const currency = (input.currency ?? account.currency).toUpperCase();

    const { payment, events } = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          id: paymentId,
          externalReference: externalReference(user.brandId),
          brandId: user.brandId,
          accountId: account.id,
          userId: user.id,
          status: status as never,
          amount: input.amount,
          currency,
          payerLabel: user.displayName,
          destinationLabel: input.destinationLabel,
          methodType: input.methodType as never,
          provider: "local-simulator",
          failureCode: status === "failed" ? "simulated_failure" : null,
          ...timestamps
        }
      });
      const event = await tx.paymentEvent.create({
        data: {
          id: `evt_${randomId()}`,
          paymentId,
          fromStatus: null,
          toStatus: status as never,
          reason: `created:${input.scenario ?? "demo"}`
        }
      });

      if (isCollected(status)) {
        await tx.paymentAccount.update({
          where: { id: account.id },
          data: {
            balance: {
              increment: input.amount
            }
          }
        });
      }

      return { payment, events: [event] };
    });

    return {
      payment: toPaymentResponse(payment),
      events: events.map(toPaymentEventResponse)
    };
  }

  async transitionPayment(
    sessionToken: string,
    paymentId: string,
    targetStatus: PaymentCoreStatus,
    reason: string
  ): Promise<PaymentCoreCreatePaymentResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const existing = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        brandId: user.brandId,
        accountId: account.id
      }
    });

    if (!existing) {
      throw new NotFoundException(`Payment was not found: ${paymentId}`);
    }

    const fromStatus = existing.status as PaymentCoreStatus;

    try {
      assertPaymentTransition(fromStatus, targetStatus);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid payment transition");
    }

    const now = new Date();
    const { payment, events } = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: targetStatus as never,
          failureCode: targetStatus === "failed" ? "simulated_failure" : existing.failureCode,
          ...timestampsFor(targetStatus, now)
        }
      });
      const event = await tx.paymentEvent.create({
        data: {
          id: `evt_${randomId()}`,
          paymentId,
          fromStatus: fromStatus as never,
          toStatus: targetStatus as never,
          reason
        }
      });

      await adjustAccountBalanceForTransition(tx, account.id, existing, targetStatus);

      return { payment, events: [event] };
    });

    return {
      payment: toPaymentResponse(payment),
      events: events.map(toPaymentEventResponse)
    };
  }

  private async createSession(user: PaymentUser): Promise<string> {
    const sessionToken = `pcses_${randomId()}${randomId()}`;
    const expiresAt = new Date(Date.now() + this.config.PAYMENT_SESSION_TTL_SECONDS * 1000);

    await this.prisma.paymentSession.create({
      data: {
        id: `ses_${randomId()}`,
        brandId: user.brandId,
        userId: user.id,
        tokenHash: tokenHash(sessionToken),
        expiresAt
      }
    });

    return sessionToken;
  }

  private async authenticate(sessionToken: string): Promise<AuthenticatedPaymentUser> {
    const session = await this.prisma.paymentSession.findUnique({
      where: {
        tokenHash: tokenHash(sessionToken)
      },
      include: {
        user: {
          include: {
            accounts: {
              orderBy: {
                createdAt: "asc"
              },
              take: 1
            }
          }
        }
      }
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session is missing or expired");
    }

    const account = session.user.accounts[0];

    if (!account || account.brandId !== session.brandId) {
      throw new UnauthorizedException("Session account is missing");
    }

    return {
      user: session.user,
      account
    };
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");

  return `pbkdf2_sha256$${salt}$${digest}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [algorithm, salt, digest] = passwordHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || !salt || !digest) {
    return false;
  }

  const candidate = pbkdf2Sync(password, salt, 120_000, 32, "sha256");
  const expected = Buffer.from(digest, "hex");

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function tokenHash(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function randomId(): string {
  return randomUUID().replaceAll("-", "");
}

function displayNameFromEmail(email: string): string {
  return email.split("@")[0] || "Payment user";
}

function externalReference(brandId: string): string {
  return `${brandId.slice(0, 8).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function timestampsFor(status: PaymentCoreStatus, date: Date): {
  authorizedAt?: Date;
  capturedAt?: Date;
  settledAt?: Date;
  refundedAt?: Date;
} {
  if (status === "authorized") {
    return { authorizedAt: date };
  }

  if (status === "captured") {
    return { authorizedAt: date, capturedAt: date };
  }

  if (status === "settled") {
    return { authorizedAt: date, capturedAt: date, settledAt: date };
  }

  if (status === "refunded") {
    return { refundedAt: date };
  }

  return {};
}

function isCollected(status: PaymentCoreStatus): boolean {
  return status === "captured" || status === "settled";
}

async function adjustAccountBalanceForTransition(
  tx: Prisma.TransactionClient,
  accountId: string,
  existing: Payment,
  targetStatus: PaymentCoreStatus
): Promise<void> {
  const fromStatus = existing.status as PaymentCoreStatus;

  if (!isCollected(fromStatus) && isCollected(targetStatus)) {
    await tx.paymentAccount.update({
      where: { id: accountId },
      data: {
        balance: {
          increment: existing.amount
        }
      }
    });
    return;
  }

  if (isCollected(fromStatus) && targetStatus === "refunded") {
    await tx.paymentAccount.update({
      where: { id: accountId },
      data: {
        balance: {
          decrement: existing.amount
        }
      }
    });
  }
}
