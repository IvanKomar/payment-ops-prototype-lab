import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { SmsController } from "../src/sms/controllers/sms.controller.js";
import { idempotencyKeyHeaderSchema, sendSmsSchema, ZodValidationPipe } from "../src/sms/dto/sms.schemas.js";
import { SmsService } from "../src/sms/sms.service.js";
import type { SendSmsCommand } from "../src/sms/sms.types.js";

describe("SmsController", () => {
  it("queues a valid send request", async () => {
    const smsService = {
      send: vi.fn(async () => ({
        jobId: "sms_test",
        status: "queued",
        provider: "Fast2SmsMockProvider",
        deduplicated: false
      })),
      getStatus: vi.fn()
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [
        {
          provide: SmsService,
          useValue: smsService
        }
      ]
    }).compile();
    const controller = moduleRef.get(SmsController);
    const command: SendSmsCommand = {
      phoneNumber: "+919876543210",
      message: "Your OTP is 123456"
    };

    await expect(controller.send(command, "otp-login-usr_123")).resolves.toEqual({
      jobId: "sms_test",
      status: "queued",
      provider: "Fast2SmsMockProvider",
      deduplicated: false
    });
    expect(smsService.send).toHaveBeenCalledWith({
      ...command,
      idempotencyKey: "otp-login-usr_123"
    });
  });

  it("rejects invalid phone numbers at the Zod boundary", () => {
    const pipe = new ZodValidationPipe<SendSmsCommand>(sendSmsSchema);

    expect(() =>
      pipe.transform({
        phoneNumber: "9876543210",
        message: "Your OTP is 123456"
      })
    ).toThrow("Validation failed");
  });

  it("rejects invalid idempotency headers", () => {
    expect(idempotencyKeyHeaderSchema.safeParse("short").success).toBe(false);
  });

  it("returns persisted status", async () => {
    const smsService = {
      send: vi.fn(),
      getStatus: vi.fn(async () => ({
        jobId: "sms_test",
        status: "sent",
        provider: "Fast2SmsMockProvider",
        attempts: 1,
        lastError: null
      }))
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [
        {
          provide: SmsService,
          useValue: smsService
        }
      ]
    }).compile();
    const controller = moduleRef.get(SmsController);

    await expect(controller.getStatus("sms_test")).resolves.toEqual({
      jobId: "sms_test",
      status: "sent",
      provider: "Fast2SmsMockProvider",
      attempts: 1,
      lastError: null
    });
  });
});
