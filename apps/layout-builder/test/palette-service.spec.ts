import { describe, expect, it } from "vitest";

import { PaletteService } from "../src/layouts/palette/palette.service.js";

describe("PaletteService", () => {
  it("extracts colors from SVG markup", () => {
    const palette = new PaletteService().fromSvg(
      '<svg><path fill="#123456"/><circle fill="rgb(220, 120, 20)"/></svg>'
    );

    expect(palette.primary).toEqual("#123456");
    expect(palette.secondary).toEqual("#dc7814");
    expect(palette.background).toEqual("#f5f7fa");
  });
});
