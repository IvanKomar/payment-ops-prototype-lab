import { Injectable } from "@nestjs/common";
import type { LayoutBuilderPaymentRow } from "@payment-ops/shared-types";
import { readFile } from "node:fs/promises";

import type { RenderLayoutInput } from "../layout.types.js";
import { createLayoutProfile, type LayoutProfile, type PaymentColumnProfile } from "./layout-profile.js";

@Injectable()
export class SvgRendererService {
  async render(input: RenderLayoutInput): Promise<string> {
    const logoDataUri = await this.logoDataUri(input.brand.logoPath, input.brand.logoMimeType);
    const palette = input.brand.palette;
    const config = input.config;
    const profile = createLayoutProfile(input.brand.id);
    const rows = config.payments.slice(0, Math.max(1, Math.min(config.pageSize, 8)));
    const width = 1180;
    const height = profile.tableTop + 62 + rows.length * profile.rowHeight;
    const text = readableText(palette.primary);
    const filters = [
      ["Method", config.filters.method],
      ["Type", config.filters.type],
      ["Status", config.filters.status],
      ["Window", `${config.filters.dateFrom} - ${config.filters.dateTo}`]
    ] as const;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(config.title)} dashboard">
  <rect width="${width}" height="${height}" fill="${escapeXml(palette.background)}"/>
  <rect x="28" y="24" width="1124" height="${height - 48}" rx="8" fill="${escapeXml(palette.surface)}" stroke="#d8dee8"/>
  <rect x="28" y="24" width="1124" height="72" rx="8" fill="${escapeXml(palette.primary)}"/>
  <image href="${escapeXml(logoDataUri)}" x="54" y="42" width="38" height="38" preserveAspectRatio="xMidYMid meet"/>
  <text x="106" y="67" fill="${text}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(input.brand.name)}</text>
  <rect x="832" y="43" width="132" height="34" rx="17" fill="${escapeXml(config.mode === "P2P" ? palette.accent : "rgba(255,255,255,0.16)")}" opacity="0.95"/>
  <text x="873" y="65" fill="${text}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700">P2P</text>
  <rect x="970" y="43" width="132" height="34" rx="17" fill="${escapeXml(config.mode === "INTENT" ? palette.accent : "rgba(255,255,255,0.16)")}" opacity="0.95"/>
  <text x="1010" y="65" fill="${text}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700">INTENT</text>
  <text x="${profile.titleX}" y="${profile.titleY}" fill="${escapeXml(palette.text)}" font-family="Inter, Arial, sans-serif" font-size="${profile.variant === "dense-ops" ? 28 : 32}" font-weight="760">${escapeXml(config.title)}</text>
  ${balanceCard(profile.balanceX, profile.balanceY, profile.variant, config.balance, config.currency, palette.secondary)}
  ${searchBox(profile.searchX, profile.searchY, config.searchTransactionId)}
  ${filters.map(([label, value], index) => filterChip(profile.filterStartX + index * profile.filterStepX, profile.filterStartY, label, value, profile.variant === "dense-ops" ? 136 : 154)).join("\n  ")}
  ${renderActions(profile, config.pageSize, palette.primary, palette.secondary, palette.accent)}
  <text x="${profile.paymentsTitleX}" y="${profile.paymentsTitleY}" fill="${escapeXml(palette.text)}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="740">${profile.variant === "dense-ops" ? "Payment operations" : "Payments"}</text>
  ${tableHeader(profile)}
  ${rows.map((row, index) => tableRow(profile.tableTop + 52 + index * profile.rowHeight, row, config.currency, profile)).join("\n  ")}
</svg>`;
  }

  private async logoDataUri(path: string, mimeType: string): Promise<string> {
    const buffer = await readFile(path);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }
}

function balanceCard(
  x: number,
  y: number,
  variant: LayoutProfile["variant"],
  balance: number,
  currency: string,
  color: string
): string {
  const width = variant === "summary-left" ? 238 : 210;
  const label = variant === "summary-left" ? "AVAILABLE BALANCE" : "BALANCE";

  return `<rect x="${x}" y="${y}" width="${width}" height="56" rx="8" fill="${escapeXml(color)}"/>
  <text x="${x + 18}" y="${y + 23}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700">${label}</text>
  <text x="${x + 18}" y="${y + 46}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="760">${escapeXml(formatMoney(balance, currency))}</text>`;
}

function searchBox(x: number, y: number, transactionId: string): string {
  return `<rect x="${x}" y="${y}" width="274" height="42" rx="6" fill="#f7f9fc" stroke="#d4dbe6"/>
  <text x="${x + 18}" y="${y + 26}" fill="#647184" font-family="Inter, Arial, sans-serif" font-size="14">Search: ${escapeXml(transactionId || "transaction id")}</text>`;
}

function filterChip(x: number, y: number, label: string, value: string, width: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="42" rx="6" fill="#ffffff" stroke="#d4dbe6"/>
  <text x="${x + 12}" y="${y + 17}" fill="#6c7788" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="700">${escapeXml(label)}</text>
  <text x="${x + 12}" y="${y + 33}" fill="#202b39" font-family="Inter, Arial, sans-serif" font-size="13">${escapeXml(value)}</text>`;
}

function renderActions(
  profile: LayoutProfile,
  pageSize: number,
  primary: string,
  secondary: string,
  accent: string
): string {
  const labels =
    profile.variant === "dense-ops"
      ? [`Rows ${pageSize}`, "Support", "Finance CSV", "Sync"]
      : [`${pageSize} / page`, "Support report", "Finance reconciliation", "Refresh"];
  const colors = [primary, secondary, secondary, accent];
  let x = profile.actionStartX;

  return labels
    .map((label, index) => {
      const width = Math.max(108, label.length * 9 + 28);
      const button = actionButton(x, profile.actionY, label, colors[index]!);
      x += width + 10;
      return button;
    })
    .join("\n  ");
}

function actionButton(x: number, y: number, label: string, color: string): string {
  return `<rect x="${x}" y="${y}" width="${Math.max(108, label.length * 9 + 28)}" height="40" rx="6" fill="${escapeXml(color)}"/>
  <text x="${x + 14}" y="${y + 25}" fill="${readableText(color)}" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(label)}</text>`;
}

function tableHeader(profile: LayoutProfile): string {
  return `<rect x="${profile.tableX}" y="${profile.tableTop}" width="${profile.tableWidth}" height="42" rx="6" fill="#edf1f7"/>
  ${profile.columns.map((column) => headerText(column, profile.tableTop, profile.headerLabelWeight)).join("\n  ")}`;
}

function headerText(column: PaymentColumnProfile, y: number, weight: number): string {
  return `<text x="${column.x}" y="${y + 26}" fill="#596579" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="${weight}">${escapeXml(column.label)}</text>`;
}

function tableRow(
  y: number,
  row: LayoutBuilderPaymentRow,
  currency: string,
  profile: LayoutProfile
): string {
  return `<rect x="${profile.tableX}" y="${y}" width="${profile.tableWidth}" height="${profile.rowHeight - 2}" fill="#ffffff" stroke="#edf1f5"/>
  ${profile.columns.map((column) => tableCell(column, y, row, currency, profile)).join("\n  ")}`;
}

function tableCell(
  column: PaymentColumnProfile,
  y: number,
  row: LayoutBuilderPaymentRow,
  currency: string,
  profile: LayoutProfile
): string {
  if (column.key === "status") {
    return statusBadge(column.x, y + 10, row.status, profile.statusStyle);
  }

  const value = paymentColumnValue(column.key, row, currency);
  const weight = column.key === "transactionId" ? 700 : 400;

  return `<text x="${column.x}" y="${y + 28}" fill="#17202a" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="${weight}">${escapeXml(value)}</text>`;
}

function paymentColumnValue(
  key: PaymentColumnProfile["key"],
  row: LayoutBuilderPaymentRow,
  currency: string
): string {
  if (key === "requestedAmount") {
    return formatMoney(row.requestedAmount, currency);
  }

  if (key === "paidAmount") {
    return formatMoney(row.paidAmount, currency);
  }

  if (key === "createdAt") {
    return formatShortDate(row.createdAt);
  }

  if (key === "paidAt") {
    return row.paidAt ? formatShortDate(row.paidAt) : "-";
  }

  if (key === "type") {
    return row.type.toUpperCase();
  }

  return String(row[key] ?? "");
}

function statusBadge(
  x: number,
  y: number,
  status: string,
  style: LayoutProfile["statusStyle"]
): string {
  const colors: Record<string, string> = {
    paid: "#087443",
    pending: "#b76e00",
    failed: "#b42318",
    refunded: "#3d5afe",
    created: "#475467"
  };
  const color = colors[status] ?? colors.created;

  if (style === "dot") {
    return `<circle cx="${x + 8}" cy="${y + 12}" r="5" fill="${color}"/>
  <text x="${x + 22}" y="${y + 17}" fill="${color}" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="760">${escapeXml(status)}</text>`;
  }

  if (style === "outline") {
    return `<rect x="${x}" y="${y}" width="82" height="24" rx="6" fill="#ffffff" stroke="${color}"/>
  <text x="${x + 12}" y="${y + 17}" fill="${color}" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="760">${escapeXml(status)}</text>`;
  }

  return `<rect x="${x}" y="${y}" width="86" height="24" rx="12" fill="${color}" opacity="0.12"/>
  <text x="${x + 13}" y="${y + 17}" fill="${color}" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="760">${escapeXml(status)}</text>`;
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2
  })}`;
}

function formatShortDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function readableText(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.58 ? "#17202a" : "#ffffff";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
