import { describe, expect, it } from "vitest";

import { createLayoutProfile } from "../src/layouts/render/layout-profile.js";

describe("createLayoutProfile", () => {
  it("varies layout, table order, and labels by brand id", () => {
    const classic = createLayoutProfile("br_00000000000000000000000000000005");
    const summaryLeft = createLayoutProfile("br_00000000000000000000000000000001");
    const denseOps = createLayoutProfile("br_00000000000000000000000000000002");

    expect(classic.variant).toEqual("classic");
    expect(summaryLeft.variant).toEqual("summary-left");
    expect(denseOps.variant).toEqual("dense-ops");
    expect(summaryLeft.columns.map((column) => column.key)).not.toEqual(
      classic.columns.map((column) => column.key)
    );
    expect(denseOps.columns.map((column) => column.label)).toContain("Txn");
    expect(summaryLeft.columns.map((column) => column.label)).toContain("Payment ref");
  });
});
