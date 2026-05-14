import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import {
  SendSmsDto,
  SendSmsResponseDto,
  sendSmsSchema,
  SmsRecentMessageResponseDto,
  SmsStatusResponseDto,
  ZodValidationPipe
} from "../dto/sms.schemas.js";
import { SmsService } from "../sms.service.js";
import type {
  SendSmsCommand,
  SendSmsResponse,
  SmsRecentMessageResponse,
  SmsStatusResponse
} from "../sms.types.js";

@ApiTags("sms")
@Controller("sms")
export class SmsController {
  constructor(@Inject(SmsService) private readonly smsService: SmsService) {}

  @Post("send")
  @ApiBody({ type: SendSmsDto })
  @ApiOkResponse({ type: SendSmsResponseDto })
  send(
    @Body(new ZodValidationPipe<SendSmsCommand>(sendSmsSchema))
    body: SendSmsCommand
  ): Promise<SendSmsResponse> {
    return this.smsService.send(body);
  }

  @Get("recent")
  @ApiOkResponse({ type: SmsRecentMessageResponseDto, isArray: true })
  getRecentMessages(): Promise<SmsRecentMessageResponse[]> {
    return this.smsService.listRecentMessages(10);
  }

  @Get("status/:jobId")
  @ApiOkResponse({ type: SmsStatusResponseDto })
  @ApiNotFoundResponse({ description: "SMS job was not found" })
  getStatus(@Param("jobId") jobId: string): Promise<SmsStatusResponse> {
    return this.smsService.getStatus(jobId);
  }
}
