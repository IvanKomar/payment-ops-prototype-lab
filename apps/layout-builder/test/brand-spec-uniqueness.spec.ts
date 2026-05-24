import { describe, expect, it } from "vitest";

import { AiBrandSpecService } from "../src/layouts/ai/ai-brand-spec.service.js";
import { BrandSpecUniquenessService } from "../src/layouts/ai/brand-spec-uniqueness.service.js";

const specService = new AiBrandSpecService({
  BRAND_AI_PROVIDER: "local",
  GEMINI_ENABLED: false,
  GEMINI_MODEL: "gemini-2.5-flash-lite"
} as ConstructorParameters<typeof AiBrandSpecService>[0]);

describe("BrandSpecUniquenessService", () => {
  const uniqueness = new BrandSpecUniquenessService();

  it("rejects a brand spec that is too similar to an active AI brand", async () => {
    const spec = await specService.generateSpec(
      {
        brandName: "Vault A",
        adminPrompt: "Create a compact settlement console"
      },
      []
    );

    const result = uniqueness.score(spec, [spec]);

    expect(result.score).toBeLessThan(result.threshold);
    expect(result.issues.join(" ")).toContain("overlap");
  });

  it("accepts clearly different routes, labels, statuses, and presentation", async () => {
    const left = await specService.generateSpec(
      {
        brandName: "Vault A",
        adminPrompt: "Create a compact settlement console"
      },
      []
    );
    const right = {
      ...left,
      resourceAlias: "orbital_clearing",
      entities: Object.fromEntries(
        Object.entries(left.entities).map(([key, entity], index) => [
          key,
          { ...entity, route: `orbital-${key.toLowerCase()}-${index}`, requestKey: `orbitalReq${index}`, responseKey: `orbitalRes${index}` }
        ])
      ) as typeof left.entities,
      fields: Object.fromEntries(
        Object.entries(left.fields).map(([group, fields]) => [
          group,
          Object.fromEntries(Object.keys(fields).map((key, index) => [key, `orbital_${group}_${index}`]))
        ])
      ) as typeof left.fields,
      statuses: {
        created: "orbitalDrafted",
        requires_payment_method: "orbitalRailNeeded",
        requires_confirmation: "orbitalApprovalNeeded",
        processing: "orbitalRouting",
        authorized: "orbitalHeld",
        captured: "orbitalCaptured",
        settled: "orbitalPosted",
        failed: "orbitalBlocked",
        canceled: "orbitalVoided",
        refunded: "orbitalReturned"
      },
      ui: {
        ...left.ui,
        labels: {
          register: "Start orbit",
          login: "Resume orbit",
          createPayment: "Route orbit",
          history: "Orbital ledger",
          refund: "Reverse orbit",
          overview: "Orbit signals",
          payments: "Orbital moves",
          customers: "Orbit parties",
          balances: "Orbit reserves"
        },
        navigation: { dashboard: "Signals", payments: "Moves", customers: "Parties", balances: "Reserves" },
        tableLabels: { id: "Orbit", status: "Phase", amount: "Mass", customer: "Node", createdAt: "Launched" },
        formLabels: { amount: "Orbit value", customer: "Node", method: "Rail" },
        presentation: {
          layout: "compact-terminal",
          density: "spacious",
          navigationPattern: "command-rail",
          dashboardComposition: ["metrics", "balances", "customers", "createPayment"],
          visualTokens: {
            palette: ["black", "cyan", "silver", "lime"],
            typography: "terminal mono with tabular settlement figures",
            radius: "2px",
            spacing: "spacious terminal panels",
            surfaces: "dark command surface with cyan rails",
            buttons: "cyan command actions with dark secondary buttons"
          },
          copyTone: "orbital treasury command language",
          componentLabels: { metricsCard: "Orbit telemetry", paymentTable: "Move register", createPanel: "Route orbit" },
          emptyStates: { payments: "No orbital moves.", customers: "No orbit parties.", balances: "No reserve signals." }
        }
      }
    };

    const result = uniqueness.score(right, [left]);

    expect(result.score).toBeGreaterThanOrEqual(result.threshold);
    expect(result.issues).toEqual([]);
  });
});
