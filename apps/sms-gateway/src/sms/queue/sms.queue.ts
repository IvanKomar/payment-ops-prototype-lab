import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";

import { SMS_QUEUE_NAME } from "../sms.constants.js";
import type { SmsQueueJobData } from "../sms.types.js";

@Injectable()
export class SmsQueue {
  constructor(@InjectQueue(SMS_QUEUE_NAME) private readonly queue: Queue<SmsQueueJobData>) {}

  async enqueue(jobId: string): Promise<void> {
    await this.queue.add(
      "send",
      { jobId },
      {
        jobId,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );
  }
}
