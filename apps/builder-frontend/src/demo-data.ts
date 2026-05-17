export function createDemoLogo(brandName: string): Blob {
  const random = seededRandom(brandName.trim() || "Payment Ops");
  const primary = hslToHex(Math.floor(random() * 360), 54, 31);
  const secondary = hslToHex((Math.floor(random() * 360) + 80) % 360, 46, 22);
  const accent = hslToHex((Math.floor(random() * 360) + 170) % 360, 72, 55);
  const initials = brandName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" rx="64" fill="${primary}"/>
  <circle cx="238" cy="86" r="48" fill="${accent}"/>
  <path d="M70 228c36-78 82-117 138-117 25 0 48 7 68 22-32 4-60 17-84 38-24 20-43 45-57 75H70z" fill="#f5f7fa"/>
  <path d="M52 250h214v28H52z" fill="${secondary}" opacity="0.8"/>
  <text x="58" y="116" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="800">${escapeSvgText(initials || "PO")}</text>
</svg>`;

  return new Blob([svg], { type: "image/svg+xml" });
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;

  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = l - chroma / 2;
  const [red, green, blue] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return `#${[red, green, blue]
    .map((value) => Math.round((value + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function escapeSvgText(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }

    throw new Error("Invalid JSON payload");
  }
}
