import { Injectable } from "@nestjs/common";
import type { LayoutBuilderPalette } from "@payment-ops/shared-types";
import { readFile } from "node:fs/promises";

import type { StoredLogo } from "../layout.types.js";

const DEFAULT_PALETTE: LayoutBuilderPalette = {
  primary: "#1f6f68",
  secondary: "#2f4858",
  accent: "#e2a528",
  background: "#f5f7fa",
  surface: "#ffffff",
  text: "#17202a"
};

@Injectable()
export class PaletteService {
  async extract(logo: StoredLogo): Promise<LayoutBuilderPalette> {
    if (logo.mimeType === "image/svg+xml") {
      const svg = await readFile(logo.path, "utf8");
      return this.fromSvg(svg);
    }

    return this.fromRaster(logo.path);
  }

  fromSvg(svg: string): LayoutBuilderPalette {
    const colors = this.extractSvgColors(svg);

    return {
      primary: colors[0] ?? DEFAULT_PALETTE.primary,
      secondary: colors[1] ?? DEFAULT_PALETTE.secondary,
      accent: colors[2] ?? DEFAULT_PALETTE.accent,
      background: DEFAULT_PALETTE.background,
      surface: DEFAULT_PALETTE.surface,
      text: DEFAULT_PALETTE.text
    };
  }

  private async fromRaster(path: string): Promise<LayoutBuilderPalette> {
    const { Vibrant } = await import("node-vibrant/node");
    const palette = await Vibrant.from(path).getPalette();

    return {
      primary: palette.Vibrant?.hex ?? DEFAULT_PALETTE.primary,
      secondary: palette.DarkVibrant?.hex ?? palette.Muted?.hex ?? DEFAULT_PALETTE.secondary,
      accent: palette.LightVibrant?.hex ?? palette.Vibrant?.hex ?? DEFAULT_PALETTE.accent,
      background: DEFAULT_PALETTE.background,
      surface: DEFAULT_PALETTE.surface,
      text: DEFAULT_PALETTE.text
    };
  }

  private extractSvgColors(svg: string): string[] {
    const colors = new Set<string>();
    const hexMatches = svg.match(/#[0-9a-f]{3,8}\b/giu) ?? [];

    for (const color of hexMatches) {
      colors.add(this.normalizeHex(color));
    }

    const rgbMatches = svg.match(/rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/giu) ?? [];

    for (const color of rgbMatches) {
      colors.add(this.rgbToHex(color));
    }

    return [...colors].filter((color) => color !== "#ffffff" && color !== "#000000").slice(0, 3);
  }

  private normalizeHex(value: string): string {
    const hex = value.toLowerCase();

    if (hex.length === 4) {
      return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }

    return hex.slice(0, 7);
  }

  private rgbToHex(value: string): string {
    const parts = value.match(/\d{1,3}/gu)?.map((part) => Math.max(0, Math.min(255, Number(part)))) ?? [
      31,
      111,
      104
    ];

    return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  }
}
