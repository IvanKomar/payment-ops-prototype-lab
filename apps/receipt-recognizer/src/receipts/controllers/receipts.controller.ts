import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";

import { loadReceiptRecognizerConfig } from "../../config/receipt-recognizer.config.js";
import {
  RawReceiptTextResponseDto,
  receiptIdSchema,
  ReceiptResponseDto,
  UploadReceiptResponseDto,
  uploadReceiptSchema,
  ZodValidationPipe
} from "../dto/receipt.schemas.js";
import { ReceiptService } from "../receipt.service.js";
import type {
  RawReceiptTextResponse,
  ReceiptResponse,
  UploadReceiptCommand,
  UploadedReceiptFile,
  UploadReceiptResponse
} from "../receipt.types.js";

const config = loadReceiptRecognizerConfig();

@ApiTags("receipts")
@Controller("receipts")
export class ReceiptsController {
  constructor(@Inject(ReceiptService) private readonly receiptService: ReceiptService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: config.RECEIPT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary"
        },
        model: {
          type: "string",
          enum: ["tesseract", "gemini"],
          default: "tesseract"
        }
      }
    }
  })
  @ApiOkResponse({ type: UploadReceiptResponseDto })
  upload(
    @UploadedFile() file: UploadedReceiptFile | undefined,
    @Body(new ZodValidationPipe<UploadReceiptCommand>(uploadReceiptSchema))
    body: UploadReceiptCommand
  ): Promise<UploadReceiptResponse> {
    return this.receiptService.upload(file, body);
  }

  @Get("recent")
  @ApiOkResponse({ type: ReceiptResponseDto, isArray: true })
  getRecentReceipts(): Promise<ReceiptResponse[]> {
    return this.receiptService.listRecentReceipts(10);
  }

  @Get(":id/raw")
  @ApiOkResponse({ type: RawReceiptTextResponseDto })
  @ApiNotFoundResponse({ description: "Receipt was not found" })
  getRawText(
    @Param("id", new ZodValidationPipe<string>(receiptIdSchema)) id: string
  ): Promise<RawReceiptTextResponse> {
    return this.receiptService.getRawText(id);
  }

  @Get(":id")
  @ApiOkResponse({ type: ReceiptResponseDto })
  @ApiNotFoundResponse({ description: "Receipt was not found" })
  getReceipt(
    @Param("id", new ZodValidationPipe<string>(receiptIdSchema)) id: string
  ): Promise<ReceiptResponse> {
    return this.receiptService.getReceipt(id);
  }
}
