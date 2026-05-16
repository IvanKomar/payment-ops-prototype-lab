import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createDefaultDashboardConfig } from "../src/layouts/default-dashboard.js";
import { SvgRendererService } from "../src/layouts/render/svg-renderer.service.js";
import type { BrandWithSchema } from "../src/layouts/layout.types.js";

describe("SvgRendererService", () => {
  it("renders a self-contained branded SVG", async () => {
    const dir = await mkdtemp(join(tmpdir(), "layout-builder-"));
    const logoPath = join(dir, "logo.svg");
    await writeFile(logoPath, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const brand: BrandWithSchema = {
      id: "br_00000000000000000000000000000001",
      name: "KOI",
      logoOriginalFilename: "logo.svg",
      logoMimeType: "image/svg+xml",
      logoSizeBytes: 45,
      logoPath,
      palette: {
        primary: "#1f6f68",
        secondary: "#2f4858",
        accent: "#e2a528",
        background: "#f5f7fa",
        surface: "#ffffff",
        text: "#17202a"
      },
      createdAt: new Date("2026-05-15T10:00:00.000Z"),
      updatedAt: new Date("2026-05-15T10:00:00.000Z"),
      schema: {
        id: "sch_33333333333333333333333333333333",
        brandId: "br_00000000000000000000000000000001",
        slug: "configure_abc",
        fieldsStyle: "snake_case",
        structure: "flat",
        fields: {}
      }
    };

    const svg = await new SvgRendererService().render({
      brand,
      config: createDefaultDashboardConfig("KOI")
    });

    expect(svg).toContain("data:image/svg+xml;base64");
    expect(svg).toContain("Payment ref");
    expect(svg).toContain("State");
  });
});
