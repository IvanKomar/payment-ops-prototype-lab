import { describe, expect, it } from "vitest";

import { brandSlug, SchemaGeneratorService } from "../src/layouts/schema/schema-generator.service.js";

describe("SchemaGeneratorService", () => {
  it("generates deterministic schema and sample payload for a brand", () => {
    const service = new SchemaGeneratorService();
    const schema = service.generate("br_11111111111111111111111111111111", "KOI");
    const same = service.generate("br_11111111111111111111111111111111", "KOI");

    expect(schema.slug).toEqual(same.slug);
    expect(schema.fieldsStyle).toEqual(same.fieldsStyle);
    expect(schema.structure).toEqual(same.structure);
    expect(schema.fields.title).toBeDefined();
    expect(schema.fields.payments).toBeDefined();
    expect(service.samplePayload(schema, "KOI")).toBeTruthy();
  });

  it("varies generated sample dashboard data by brand id", () => {
    const service = new SchemaGeneratorService();
    const first = service.generate("br_11111111111111111111111111111111", "KOI");
    const second = service.generate("br_22222222222222222222222222222222", "KOI");

    expect(service.samplePayload(first, "KOI")).not.toEqual(service.samplePayload(second, "KOI"));
  });

  it("normalizes cyrillic brand names for public endpoints", () => {
    expect(brandSlug("Палец в верх")).toBe("palets-v-verh");
    expect(brandSlug("Nova Ledger")).toBe("nova-ledger");
  });
});
