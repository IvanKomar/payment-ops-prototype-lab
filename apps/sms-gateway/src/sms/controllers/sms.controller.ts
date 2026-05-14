import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiBody, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import {
  idempotencyKeyHeaderSchema,
  SendSmsDto,
  SendSmsResponseDto,
  sendSmsSchema,
  SmsStatusResponseDto,
  ZodValidationPipe
} from "../dto/sms.schemas.js";
import { SmsService } from "../sms.service.js";
import type { SendSmsCommand, SendSmsResponse, SmsStatusResponse } from "../sms.types.js";

@ApiTags("sms")
@Controller("sms")
export class SmsController {
  constructor(@Inject(SmsService) private readonly smsService: SmsService) {}

  @Post("send")
  @ApiBody({ type: SendSmsDto })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "Optional duplicate-send guard for one logical SMS operation"
  })
  @ApiOkResponse({ type: SendSmsResponseDto })
  send(
    @Body(new ZodValidationPipe<Omit<SendSmsCommand, "idempotencyKey">>(sendSmsSchema))
    body: Omit<SendSmsCommand, "idempotencyKey">,
    @Headers("idempotency-key") idempotencyKeyHeader?: string
  ): Promise<SendSmsResponse> {
    const idempotencyKey = this.parseIdempotencyKey(idempotencyKeyHeader);

    return this.smsService.send({
      ...body,
      idempotencyKey
    });
  }

  @Get("status/:jobId")
  @ApiOkResponse({ type: SmsStatusResponseDto })
  @ApiNotFoundResponse({ description: "SMS job was not found" })
  getStatus(@Param("jobId") jobId: string): Promise<SmsStatusResponse> {
    return this.smsService.getStatus(jobId);
  }

  private parseIdempotencyKey(value: string | undefined): string | undefined {
    const result = idempotencyKeyHeaderSchema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: "Invalid Idempotency-Key header",
        issues: result.error.issues
      });
    }

    return result.data;
  }
}
