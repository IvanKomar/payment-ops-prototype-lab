export const LAYOUT_BUILDER_CONFIG = Symbol("LAYOUT_BUILDER_CONFIG");

export const ACCEPTED_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml"
] as const;

export const CANONICAL_FIELDS = [
  "title",
  "balance",
  "currency",
  "pageSize",
  "payments"
] as const;
