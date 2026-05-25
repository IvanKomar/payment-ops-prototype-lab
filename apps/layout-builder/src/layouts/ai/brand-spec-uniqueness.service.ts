import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiBrandSpec,
  LayoutBuilderBrandSpecUniquenessResult
} from "@payment-ops/shared-types";

export const BRAND_SPEC_UNIQUENESS_THRESHOLD = 70;

@Injectable()
export class BrandSpecUniquenessService {
  score(spec: LayoutBuilderAiBrandSpec, existingSpecs: LayoutBuilderAiBrandSpec[]): LayoutBuilderBrandSpecUniquenessResult {
    if (existingSpecs.length === 0) {
      return { score: 100, threshold: BRAND_SPEC_UNIQUENESS_THRESHOLD, issues: [] };
    }

    const worst = existingSpecs
      .map((existing) => similarityAgainstExisting(spec, existing))
      .sort((left, right) => right.similarity - left.similarity)[0]!;
    const score = Math.max(0, Math.round(100 - worst.similarity));
    const issues = score >= BRAND_SPEC_UNIQUENESS_THRESHOLD ? [] : worst.issues;

    return { score, threshold: BRAND_SPEC_UNIQUENESS_THRESHOLD, issues };
  }
}

function similarityAgainstExisting(spec: LayoutBuilderAiBrandSpec, existing: LayoutBuilderAiBrandSpec): { similarity: number; issues: string[] } {
  const routeOverlap = overlap(entityRoutes(spec), entityRoutes(existing));
  const aliasOverlap = overlap(fieldAliases(spec), fieldAliases(existing));
  const statusOverlap = overlap(Object.values(spec.statuses), Object.values(existing.statuses));
  const labelOverlap = overlap(uiLabels(spec), uiLabels(existing));
  const paletteOverlap = overlap(spec.ui.presentation.visualTokens.palette, existing.ui.presentation.visualTokens.palette);
  const sameLayout = spec.ui.presentation.layout === existing.ui.presentation.layout ? 1 : 0;
  const sameNavigation = spec.ui.presentation.navigationPattern === existing.ui.presentation.navigationPattern ? 1 : 0;
  const samePayloadStructure = spec.controls.payloadStructure === existing.controls.payloadStructure ? 1 : 0;
  const sameFieldStyle = spec.controls.fieldStyle === existing.controls.fieldStyle ? 1 : 0;
  const sameEnvelope = spec.controls.responseEnvelope === existing.controls.responseEnvelope ? 1 : 0;
  const dashboardOverlap = overlap(spec.ui.presentation.dashboardComposition, existing.ui.presentation.dashboardComposition);
  const copyOverlap = tokenOverlap(spec.ui.presentation.copyTone, existing.ui.presentation.copyTone);

  const similarity = Math.min(
    100,
    routeOverlap * 24 +
      aliasOverlap * 18 +
      statusOverlap * 16 +
      labelOverlap * 12 +
      paletteOverlap * 8 +
      sameLayout * 6 +
      sameNavigation * 4 +
      samePayloadStructure * 4 +
      sameFieldStyle * 3 +
      sameEnvelope * 3 +
      dashboardOverlap * 4 +
      copyOverlap * 8
  );
  const issues = [
    routeOverlap > 0.2 ? `Public route overlap is too high (${percent(routeOverlap)}).` : "",
    aliasOverlap > 0.25 ? `Field alias overlap is too high (${percent(aliasOverlap)}).` : "",
    statusOverlap > 0.3 ? `Status label overlap is too high (${percent(statusOverlap)}).` : "",
    labelOverlap > 0.3 ? `UI label overlap is too high (${percent(labelOverlap)}).` : "",
    sameLayout ? `UI layout repeats an existing brand (${spec.ui.presentation.layout}).` : "",
    sameNavigation ? `Navigation pattern repeats an existing brand (${spec.ui.presentation.navigationPattern}).` : "",
    samePayloadStructure ? `Payload structure repeats an existing brand (${spec.controls.payloadStructure}).` : "",
    sameFieldStyle ? `Field style repeats an existing brand (${spec.controls.fieldStyle}).` : "",
    sameEnvelope ? `Response envelope repeats an existing brand (${spec.controls.responseEnvelope}).` : "",
    dashboardOverlap > 0.6 ? `Dashboard composition is too similar (${percent(dashboardOverlap)}).` : "",
    copyOverlap > 0.35 ? `Copy tone is too similar (${percent(copyOverlap)} token overlap).` : ""
  ].filter(Boolean);

  return {
    similarity,
    issues: issues.length > 0 ? issues : ["Brand spec is too similar to an existing active AI brand."]
  };
}

function entityRoutes(spec: LayoutBuilderAiBrandSpec): string[] {
  return Object.values(spec.entities).map((entity) => entity.route);
}

function fieldAliases(spec: LayoutBuilderAiBrandSpec): string[] {
  return Object.values(spec.fields).flatMap((group) => Object.values(group));
}

function uiLabels(spec: LayoutBuilderAiBrandSpec): string[] {
  return [
    ...Object.values(spec.ui.labels),
    ...Object.values(spec.ui.navigation),
    ...Object.values(spec.ui.tableLabels),
    ...Object.values(spec.ui.formLabels),
    ...Object.values(spec.ui.presentation.componentLabels),
    ...Object.values(spec.ui.presentation.emptyStates)
  ];
}

function overlap(left: readonly string[], right: readonly string[]): number {
  const leftTokens = new Set(left.map(normalize).filter(Boolean));
  const rightTokens = new Set(right.map(normalize).filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function tokenOverlap(left: string, right: string): number {
  return overlap(tokens(left), tokens(right));
}

function tokens(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/iu)
    .map(normalize)
    .filter((token) => token.length > 2);
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ");
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
