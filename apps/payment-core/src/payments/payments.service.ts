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
  PaymentCoreBalanceTransactionsResponse,
  PaymentCoreCreatePaymentResponse,
  PaymentCoreCustomersResponse,
  PaymentCoreHistoryResponse,
  PaymentCoreMethodType,
  PaymentCorePaymentIntentsResponse,
  PaymentCorePaymentMethodsResponse,
  PaymentCoreStatus
} from "@payment-ops/shared-types";
import type { Payment, PaymentAccount, PaymentCustomer, PaymentMethod, PaymentUser, Prisma } from "@prisma/client";
import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { loadPaymentCoreConfig } from "../config/payment-core.config.js";
import { assertPaymentTransition, initialStatusForScenario } from "./payment-state.js";
import type { CreatePaymentInput, LoginInput, RegisterInput } from "./dto/payment.schemas.js";
import {
  toAccountResponse,
  toBalanceTransactionResponse,
  toCustomerResponse,
  toPaymentEventResponse,
  toPaymentIntentResponse,
  toPaymentMethodResponse,
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
    const [payments, customers, paymentMethods, balanceTransactions] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          brandId: user.brandId,
          accountId: account.id
        },
        include: {
          customer: true,
          paymentIntent: true,
          paymentMethod: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 50
      }),
      this.prisma.paymentCustomer.findMany({
        where: {
          brandId: user.brandId,
          accountId: account.id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100
      }),
      this.prisma.paymentMethod.findMany({
        where: {
          brandId: user.brandId,
          accountId: account.id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100
      }),
      this.prisma.balanceTransaction.findMany({
        where: {
          brandId: user.brandId,
          accountId: account.id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100
      })
    ]);

    return {
      account: toAccountResponse(account),
      payments: payments.map(toPaymentResponse),
      customers: customers.map(toCustomerResponse),
      paymentMethods: paymentMethods.map(toPaymentMethodResponse),
      balanceTransactions: balanceTransactions.map(toBalanceTransactionResponse)
    };
  }

  async customers(sessionToken: string): Promise<PaymentCoreCustomersResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const customers = await this.prisma.paymentCustomer.findMany({
      where: {
        brandId: user.brandId,
        accountId: account.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return {
      account: toAccountResponse(account),
      customers: customers.map(toCustomerResponse)
    };
  }

  async paymentMethods(sessionToken: string): Promise<PaymentCorePaymentMethodsResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const paymentMethods = await this.prisma.paymentMethod.findMany({
      where: {
        brandId: user.brandId,
        accountId: account.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return {
      account: toAccountResponse(account),
      paymentMethods: paymentMethods.map(toPaymentMethodResponse)
    };
  }

  async paymentIntents(sessionToken: string): Promise<PaymentCorePaymentIntentsResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const paymentIntents = await this.prisma.paymentIntent.findMany({
      where: {
        brandId: user.brandId,
        accountId: account.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return {
      account: toAccountResponse(account),
      paymentIntents: paymentIntents.map(toPaymentIntentResponse)
    };
  }

  async balanceTransactions(sessionToken: string): Promise<PaymentCoreBalanceTransactionsResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const balanceTransactions = await this.prisma.balanceTransaction.findMany({
      where: {
        brandId: user.brandId,
        accountId: account.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return {
      account: toAccountResponse(account),
      balanceTransactions: balanceTransactions.map(toBalanceTransactionResponse)
    };
  }

  async createPayment(
    sessionToken: string,
    input: CreatePaymentInput
  ): Promise<PaymentCoreCreatePaymentResponse> {
    const { user, account } = await this.authenticate(sessionToken);
    const paymentId = `pay_${randomId()}`;
    const intentId = `pi_${randomId()}`;
    const methodType = input.paymentMethod?.type ?? input.methodType ?? "card";
    const externalPaymentReference = externalReference(user.brandId);
    const externalIntentReference = externalReference(user.brandId);
    const destinationLabel = input.destinationLabel ?? destinationLabelForStructuredInput(input);
    const status = initialStatusForScenario({
      paymentId,
      destinationLabel,
      ...(input.scenario ? { scenario: input.scenario } : {})
    });
    const now = new Date();
    const timestamps = timestampsFor(status, now);
    const currency = (input.currency ?? account.currency).toUpperCase();

    const { payment, events } = await this.prisma.$transaction(async (tx) => {
      const customer = await resolveCustomer(tx, user, account, input);
      const paymentMethod = await resolvePaymentMethod(tx, user, account, customer, methodType, input);
      const intent = await tx.paymentIntent.create({
        data: {
          id: intentId,
          externalReference: externalIntentReference,
          brandId: user.brandId,
          accountId: account.id,
          userId: user.id,
          customerId: customer?.id ?? null,
          paymentMethodId: paymentMethod?.id ?? null,
          status: status as never,
          amount: input.amount,
          currency,
          description: input.description ?? `Payment ${externalPaymentReference}`
        }
      });
      const payment = await tx.payment.create({
        include: {
          customer: true,
          paymentIntent: true,
          paymentMethod: true
        },
        data: {
          id: paymentId,
          externalReference: externalPaymentReference,
          brandId: user.brandId,
          accountId: account.id,
          userId: user.id,
          customerId: customer?.id ?? null,
          paymentMethodId: paymentMethod?.id ?? null,
          paymentIntentId: intent.id,
          status: status as never,
          amount: input.amount,
          currency,
          payerLabel: user.displayName,
          destinationLabel,
          methodType: methodType as never,
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
        await createBalanceTransaction(tx, {
          accountId: account.id,
          amount: input.amount,
          brandId: user.brandId,
          currency,
          description: `${status === "settled" ? "Settled" : "Captured"} ${externalPaymentReference}`,
          paymentId,
          type: status === "settled" ? "payment_settlement" : "payment_capture"
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
        include: {
          customer: true,
          paymentIntent: true,
          paymentMethod: true
        },
        data: {
          status: targetStatus as never,
          failureCode: targetStatus === "failed" ? "simulated_failure" : existing.failureCode,
          ...timestampsFor(targetStatus, now)
        }
      });
      if (existing.paymentIntentId) {
        await tx.paymentIntent.update({
          where: { id: existing.paymentIntentId },
          data: {
            status: targetStatus as never
          }
        });
      }
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

async function resolveCustomer(
  tx: Prisma.TransactionClient,
  user: PaymentUser,
  account: PaymentAccount,
  input: CreatePaymentInput
): Promise<PaymentCustomer | null> {
  const customerInput = input.customer;

  if (!customerInput) {
    return null;
  }

  if (customerInput.customerId) {
    const existing = await tx.paymentCustomer.findFirst({
      where: {
        id: customerInput.customerId,
        brandId: user.brandId,
        accountId: account.id
      }
    });

    if (!existing) {
      throw new NotFoundException(`Customer was not found: ${customerInput.customerId}`);
    }

    return existing;
  }

  if (customerInput.email) {
    return tx.paymentCustomer.upsert({
      where: {
        brandId_accountId_email: {
          brandId: user.brandId,
          accountId: account.id,
          email: customerInput.email
        }
      },
      create: {
        id: `cus_${randomId()}`,
        brandId: user.brandId,
        accountId: account.id,
        userId: user.id,
        email: customerInput.email,
        name: customerInput.name,
        phone: customerInput.phone ?? null
      },
      update: {
        name: customerInput.name,
        phone: customerInput.phone ?? null
      }
    });
  }

  return tx.paymentCustomer.create({
    data: {
      id: `cus_${randomId()}`,
      brandId: user.brandId,
      accountId: account.id,
      userId: user.id,
      name: customerInput.name,
      phone: customerInput.phone ?? null
    }
  });
}

async function resolvePaymentMethod(
  tx: Prisma.TransactionClient,
  user: PaymentUser,
  account: PaymentAccount,
  customer: PaymentCustomer | null,
  methodType: PaymentCoreMethodType,
  input: CreatePaymentInput
): Promise<PaymentMethod | null> {
  const methodInput = input.paymentMethod;

  if (methodInput?.paymentMethodId) {
    const existing = await tx.paymentMethod.findFirst({
      where: {
        id: methodInput.paymentMethodId,
        brandId: user.brandId,
        accountId: account.id
      }
    });

    if (!existing) {
      throw new NotFoundException(`Payment method was not found: ${methodInput.paymentMethodId}`);
    }

    return existing;
  }

  if (!methodInput && !customer) {
    return null;
  }

  const last4 = methodInput?.last4 ?? last4FromLabel(input.destinationLabel);
  const label = methodInput?.label ?? paymentMethodLabel(methodType, last4, methodInput?.bankName);

  return tx.paymentMethod.create({
    data: {
      id: `pm_${randomId()}`,
      brandId: user.brandId,
      accountId: account.id,
      customerId: customer?.id ?? null,
      type: methodType as never,
      label,
      last4: last4 ?? null,
      brand: methodInput?.brand ?? null,
      expiryMonth: methodInput?.expiryMonth ?? null,
      expiryYear: methodInput?.expiryYear ?? null,
      bankName: methodInput?.bankName ?? null
    }
  });
}

async function createBalanceTransaction(
  tx: Prisma.TransactionClient,
  input: {
    accountId: string;
    amount: number;
    brandId: string;
    currency: string;
    description: string;
    paymentId: string;
    type: "payment_capture" | "payment_settlement" | "refund" | "adjustment";
  }
): Promise<void> {
  await tx.balanceTransaction.create({
    data: {
      id: `bt_${randomId()}`,
      accountId: input.accountId,
      amount: input.amount,
      brandId: input.brandId,
      currency: input.currency,
      description: input.description,
      paymentId: input.paymentId,
      type: input.type as never
    }
  });
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

function destinationLabelForStructuredInput(input: CreatePaymentInput): string {
  const customerLabel = input.customer?.name ?? input.customer?.email ?? "Customer";
  const methodType = input.paymentMethod?.type ?? input.methodType ?? "card";
  const methodLabel = input.paymentMethod?.label ?? paymentMethodLabel(methodType, input.paymentMethod?.last4, input.paymentMethod?.bankName);

  return `${customerLabel} | ${methodLabel}`;
}

function paymentMethodLabel(methodType: PaymentCoreMethodType, last4?: string, bankName?: string): string {
  if (methodType === "bank_transfer") {
    return bankName ? `${bankName} account${last4 ? ` ending ${last4}` : ""}` : `Bank account${last4 ? ` ending ${last4}` : ""}`;
  }

  if (methodType === "wallet") {
    return last4 ? `Wallet ${last4}` : "Wallet";
  }

  if (methodType === "crypto") {
    return last4 ? `Crypto wallet ${last4}` : "Crypto wallet";
  }

  if (methodType === "manual") {
    return "Manual payment source";
  }

  return last4 ? `Card ending ${last4}` : "Card";
}

function last4FromLabel(value: string | undefined): string | undefined {
  const compact = value?.replace(/[^0-9A-Za-z]/gu, "") ?? "";

  return compact.length >= 4 ? compact.slice(-4) : undefined;
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
    await createBalanceTransaction(tx, {
      accountId,
      amount: existing.amount,
      brandId: existing.brandId,
      currency: existing.currency,
      description: `${targetStatus === "settled" ? "Settled" : "Captured"} ${existing.externalReference}`,
      paymentId: existing.id,
      type: targetStatus === "settled" ? "payment_settlement" : "payment_capture"
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
    await createBalanceTransaction(tx, {
      accountId,
      amount: -existing.amount,
      brandId: existing.brandId,
      currency: existing.currency,
      description: `Refunded ${existing.externalReference}`,
      paymentId: existing.id,
      type: "refund"
    });
  }
}
