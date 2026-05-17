export function createDemoLogo(brandName: string): Blob {
  const initials = brandName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" rx="64" fill="#17534e"/>
  <circle cx="238" cy="86" r="48" fill="#e2a528"/>
  <path d="M70 228c36-78 82-117 138-117 25 0 48 7 68 22-32 4-60 17-84 38-24 20-43 45-57 75H70z" fill="#f5f7fa"/>
  <text x="58" y="116" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="800">${escapeSvgText(initials || "PO")}</text>
</svg>`;

  return new Blob([svg], { type: "image/svg+xml" });
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
