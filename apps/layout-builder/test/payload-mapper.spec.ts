import { describe, expect, it } from "vitest";

import { createDefaultDashboardConfig } from "../src/layouts/default-dashboard.js";
import { PayloadMapperService } from "../src/layouts/schema/payload-mapper.service.js";
import { SchemaGeneratorService } from "../src/layouts/schema/schema-generator.service.js";
import type { GeneratedSchema } from "../src/layouts/layout.types.js";

const generator = new SchemaGeneratorService();
const mapper = new PayloadMapperService();
const brandId = "br_22222222222222222222222222222222";
const config = createDefaultDashboardConfig("KOI", brandId);

function schema(structure: GeneratedSchema["structure"]): GeneratedSchema {
  return {
    ...generator.generate(brandId, "KOI"),
    structure
  };
}

describe("PayloadMapperService", () => {
  it("maps flat payloads into canonical dashboard config", () => {
    const generated = schema("flat");
    const payload = generator.samplePayload(generated, "KOI");

    expect(mapper.toCanonical(generated, payload)).toMatchObject({
      title: config.title,
      currency: config.currency,
      payments: expect.arrayContaining([expect.objectContaining({ transactionId: config.payments[0]?.transactionId })])
    });
    expect(mapper.toExternal(generated, config)).toEqual(payload);
  });

  it("maps nested payloads into canonical dashboard config", () => {
    const generated = schema("nested");
    const payload = generator.samplePayload(generated, "KOI");
    const canonical = mapper.toCanonical(generated, payload);

    expect(canonical).toMatchObject({
      balance: config.balance,
      pageSize: config.pageSize,
      payments: expect.arrayContaining([expect.objectContaining({ status: config.payments[0]?.status })])
    });
    expect(mapper.toExternal(generated, config)).toEqual(payload);
  });

  it("maps key-value-array payloads into canonical dashboard config", () => {
    const generated = schema("key-value-array");
    const payload = generator.samplePayload(generated, "KOI");

    expect(mapper.toCanonical(generated, payload).balance).toEqual(config.balance);
    expect(mapper.toExternal(generated, config)).toEqual(payload);
  });
});
