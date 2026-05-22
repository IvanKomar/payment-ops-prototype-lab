import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type {
  LayoutBuilderAdminAuthResponse,
  LayoutBuilderBrandMembership,
  PaymentCoreAuthResponse
} from "@payment-ops/shared-types";
import type { AdminIdentity, AdminSession, BrandMembership } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { LayoutBuilderEnv } from "../../config/env.schema.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { LAYOUT_BUILDER_CONFIG } from "../layout.constants.js";

const DEV_ADMIN_NAME = "Local Platform Admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthBoundaryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv
  ) {}

  async loginAdmin(input: { email: string; password: string }): Promise<LayoutBuilderAdminAuthResponse> {
    if (input.email !== this.config.LAYOUT_ADMIN_EMAIL || input.password !== this.config.LAYOUT_ADMIN_PASSWORD) {
      throw new UnauthorizedException("Invalid admin email or password");
    }

    const admin = await this.ensureDevAdmin();
    return this.createSessionForAdmin(admin);
  }

  async createDevAdminSession(): Promise<LayoutBuilderAdminAuthResponse> {
    if (!this.config.LAYOUT_DEV_ADMIN_FALLBACK) {
      throw new UnauthorizedException("Dev admin fallback is disabled");
    }

    const admin = await this.ensureDevAdmin();
    return this.createSessionForAdmin(admin);
  }

  private async createSessionForAdmin(admin: AdminIdentity): Promise<LayoutBuilderAdminAuthResponse> {
    const sessionToken = `adm_${randomBytes(32).toString("hex")}`;
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await this.prisma.adminSession.create({
      data: {
        id: `asess_${randomId()}`,
        adminId: admin.id,
        tokenHash: tokenHash(sessionToken),
        expiresAt
      }
    });

    return toAdminAuthResponse(admin, session, sessionToken);
  }

  async resolveAdminSession(sessionToken: string | undefined): Promise<LayoutBuilderAdminAuthResponse> {
    if (!sessionToken) {
      if (!this.config.LAYOUT_DEV_ADMIN_FALLBACK) {
        throw new UnauthorizedException("Admin session is required");
      }

      return this.createDevAdminSession();
    }

    const session = await this.prisma.adminSession.findUnique({
      where: {
        tokenHash: tokenHash(sessionToken)
      },
      include: {
        admin: true
      }
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Admin session is invalid or expired");
    }

    return toAdminAuthResponse(session.admin, session, sessionToken);
  }

  async ensureBrandOwnerMembership(brandId: string, sessionToken?: string): Promise<LayoutBuilderBrandMembership> {
    const auth = await this.resolveAdminSession(sessionToken);
    const membership = await this.prisma.brandMembership.upsert({
      where: {
        brandId_subjectKey: {
          brandId,
          subjectKey: `admin:${auth.admin.adminId}`
        }
      },
      create: {
        id: `mbr_${randomId()}`,
        brandId,
        subjectType: "admin",
        subjectKey: `admin:${auth.admin.adminId}`,
        role: "platform_admin",
        source: "admin_console",
        adminId: auth.admin.adminId
      },
      update: {
        role: "platform_admin",
        source: "admin_console",
        adminId: auth.admin.adminId
      }
    });

    return toBrandMembershipResponse(membership);
  }

  async recordMerchantMembership(response: PaymentCoreAuthResponse, source: "brand_runtime" | "demo_seed" = "brand_runtime"): Promise<void> {
    await this.prisma.brandMembership
      .upsert({
        where: {
          brandId_subjectKey: {
            brandId: response.user.brandId,
            subjectKey: `merchant:${response.user.userId}`
          }
        },
        create: {
          id: `mbr_${randomId()}`,
          brandId: response.user.brandId,
          subjectType: "merchant",
          subjectKey: `merchant:${response.user.userId}`,
          role: "merchant_owner",
          source,
          merchantUserId: response.user.userId,
          merchantEmail: response.user.email,
          merchantDisplayName: response.user.displayName,
          merchantAccountId: response.account.accountId
        },
        update: {
          role: "merchant_owner",
          source,
          merchantEmail: response.user.email,
          merchantDisplayName: response.user.displayName,
          merchantAccountId: response.account.accountId
        }
      })
      .then(() => undefined);
  }

  async listBrandMemberships(brandId: string): Promise<LayoutBuilderBrandMembership[]> {
    const memberships = await this.prisma.brandMembership.findMany({
      where: {
        brandId
      },
      orderBy: [
        {
          role: "asc"
        },
        {
          createdAt: "desc"
        }
      ],
      take: 100
    });

    return memberships.map(toBrandMembershipResponse);
  }

  private async ensureDevAdmin(): Promise<AdminIdentity> {
    return this.prisma.adminIdentity.upsert({
      where: {
        email: this.config.LAYOUT_ADMIN_EMAIL
      },
      create: {
        id: `admin_${randomId()}`,
        email: this.config.LAYOUT_ADMIN_EMAIL,
        displayName: DEV_ADMIN_NAME,
        role: "platform_admin"
      },
      update: {
        displayName: DEV_ADMIN_NAME,
        role: "platform_admin"
      }
    });
  }
}

function toAdminAuthResponse(
  admin: AdminIdentity,
  session: Pick<AdminSession, "expiresAt">,
  sessionToken: string
): LayoutBuilderAdminAuthResponse {
  return {
    sessionToken,
    admin: {
      adminId: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      role: "platform_admin",
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString()
    },
    expiresAt: session.expiresAt.toISOString()
  };
}

function toBrandMembershipResponse(membership: BrandMembership): LayoutBuilderBrandMembership {
  return {
    membershipId: membership.id,
    brandId: membership.brandId,
    subjectType: membership.subjectType === "admin" ? "admin" : "merchant",
    subjectKey: membership.subjectKey,
    role:
      membership.role === "platform_admin" || membership.role === "brand_operator"
        ? membership.role
        : "merchant_owner",
    source:
      membership.source === "admin_console" || membership.source === "demo_seed"
        ? membership.source
        : "brand_runtime",
    adminId: membership.adminId,
    merchantUserId: membership.merchantUserId,
    merchantEmail: membership.merchantEmail,
    merchantDisplayName: membership.merchantDisplayName,
    merchantAccountId: membership.merchantAccountId,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString()
  };
}

function randomId(): string {
  return randomUUID().replaceAll("-", "");
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
