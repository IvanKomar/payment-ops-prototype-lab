import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@payment-ops/shared-types";

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  getHealth(): HealthResponse {
    return {
      service: "sms-gateway",
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString()
    };
  }
}
