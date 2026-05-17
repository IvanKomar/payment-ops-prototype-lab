import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { LayoutBuilderEnv } from "../../config/env.schema.js";
import { LAYOUT_BUILDER_CONFIG } from "../layout.constants.js";
import type { StoredLogo, UploadedLogoFile } from "../layout.types.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const SVG_UNSAFE_PATTERN =
  /<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:|data:text\/html|xlink:href\s*=\s*["']https?:|href\s*=\s*["']https?:/iu;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg"
};

@Injectable()
export class LogoStorageService {
  constructor(@Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv) {}

  async store(file: UploadedLogoFile): Promise<StoredLogo> {
    if (!file.buffer?.length) {
      throw new BadRequestException("Logo file is required");
    }

    if (file.mimetype === "image/svg+xml") {
      this.assertSafeSvg(file.buffer.toString("utf8"));
    }

    const uploadDir = resolve(process.cwd(), this.config.LAYOUT_LOGO_UPLOAD_DIR);
    await mkdir(uploadDir, { recursive: true });

    const extension = MIME_EXTENSIONS[file.mimetype] ?? (extname(file.originalname) || ".logo");
    const filename = `${randomUUID().replaceAll("-", "")}${extension}`;
    const path = resolve(uploadDir, filename);

    await writeFile(path, file.buffer);

    return {
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      path
    };
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  private assertSafeSvg(svg: string): void {
    if (SVG_UNSAFE_PATTERN.test(svg)) {
      throw new BadRequestException("SVG logo contains unsupported unsafe markup");
    }
  }
}
