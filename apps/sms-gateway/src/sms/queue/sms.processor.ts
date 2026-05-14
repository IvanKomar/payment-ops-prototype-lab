import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";

import { SMS_QUEUE_NAME } from "../sms.constants.js";
import { SmsService } from "../sms.service.js";
import type { SmsQueueJobData } from "../sms.types.js";

@Processor(SMS_QUEUE_NAME)
export class SmsProcessor extends WorkerHost {
  constructor(@Inject(SmsService) private readonly smsService: SmsService) {
    super();
  }

  async process(job: Job<SmsQueueJobData>): Promise<void> {
    await this.smsService.processQueuedMessage(job.data.jobId);
  }
}
