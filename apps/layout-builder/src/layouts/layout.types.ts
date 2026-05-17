import type {
  LayoutBuilderDashboardConfig,
  LayoutBuilderFieldStyle,
  LayoutBuilderPalette,
  LayoutBuilderPayloadStructure
} from "@payment-ops/shared-types";
import type { LayoutProfile } from "./render/layout-profile.js";

export interface UploadedLogoFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredLogo {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  path: string;
}

export interface GeneratedSchema {
  id: string;
  brandId: string;
  slug: string;
  fieldsStyle: LayoutBuilderFieldStyle;
  structure: LayoutBuilderPayloadStructure;
  fields: Record<string, string>;
  templateProfile: LayoutProfile;
}

export interface BrandWithSchema {
  id: string;
  name: string;
  logoOriginalFilename: string;
  logoMimeType: string;
  logoSizeBytes: number;
  logoPath: string;
  palette: LayoutBuilderPalette;
  createdAt: Date;
  updatedAt: Date;
  schema: GeneratedSchema;
}

export interface CreateBrandInput {
  name: string;
  logo: StoredLogo;
  palette: LayoutBuilderPalette;
  schema: GeneratedSchema;
}

export interface SaveBrandRequestInput {
  id: string;
  brandId: string;
  schemaId: string;
  originalPayload: unknown;
  canonicalPayload: LayoutBuilderDashboardConfig;
  renderedSvg: string;
}

export interface RenderLayoutInput {
  brand: BrandWithSchema;
  config: LayoutBuilderDashboardConfig;
}
