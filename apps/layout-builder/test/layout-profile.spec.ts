import { describe, expect, it } from "vitest";

import { createLayoutProfile, type LayoutProfile } from "../src/layouts/render/layout-profile.js";

describe("createLayoutProfile", () => {
  it("varies layout, table order, and labels by brand id", () => {
    const profiles = Array.from({ length: 10 }, (_, index) =>
      createLayoutProfile(`br_${String(index).padStart(32, "0")}`)
    );
    const variants = new Set(profiles.map((profile) => profile.variant));
    const labelSets = new Set(profiles.map((profile) => profile.labelSet));
    const columnOrders = new Set(
      profiles.map((profile) => profile.columns.map((column) => column.key).join(","))
    );

    expect(variants.size).toBeGreaterThanOrEqual(4);
    expect(labelSets.size).toBeGreaterThanOrEqual(4);
    expect(columnOrders.size).toBeGreaterThanOrEqual(4);
    expect(profiles.some((profile) => profile.columns.some((column) => column.label !== column.key))).toBe(
      true
    );
  });

  it("selects a profile that differs from recent profiles", () => {
    const recent = Array.from({ length: 6 }, (_, index) => createLayoutProfile(brandId(index)));
    const next = createLayoutProfile("br_99999999999999999999999999999999", recent);

    expect(recent.slice(0, 5).some((profile) => profile.templateId === next.templateId)).toBe(false);
  });

  it("keeps the nearest generated brands visually distinct", () => {
    const recent: LayoutProfile[] = [];

    for (let index = 0; index < 6; index += 1) {
      recent.unshift(createLayoutProfile(brandId(index + 20), recent));
    }

    expect(new Set(recent.map((profile) => profile.variant)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(recent.map((profile) => profile.labelSet)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(recent.map((profile) => profile.templateId)).size).toBe(6);
  });
});

function brandId(index: number): string {
  return `br_${String(index).padStart(32, "0")}`;
}
