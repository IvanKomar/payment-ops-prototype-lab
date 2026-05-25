import { describe, expect, it } from "vitest";

import { AiBrandSpecService } from "../src/layouts/ai/ai-brand-spec.service.js";
import { BrandIntentCompilerService } from "../src/layouts/ai/brand-intent-compiler.service.js";

const specService = new AiBrandSpecService({
  BRAND_AI_PROVIDER: "local",
  GEMINI_ENABLED: false,
  GEMINI_MODEL: "gemini-2.5-flash-lite"
} as ConstructorParameters<typeof AiBrandSpecService>[0]);

describe("BrandIntentCompilerService", () => {
  it("compiles external chat intent into a valid AI brand spec without reserved public routes", () => {
    const spec = new BrandIntentCompilerService().compile({
      brandName: "Copper Harbor",
      concept: {
        domain: "merchant acquiring for regional commerce teams",
        audience: "market operators",
        productMetaphor: "harbor control",
        authMetaphor: "dock pass",
        paymentMetaphor: "cargo clearing",
        tone: "practical port-operations finance language",
        avoidWords: ["stripe", "payment-core", "bff", "runtime", "profile"],
        preferredTerms: ["harbor", "dock", "cargo", "operator", "berth", "tide"]
      },
      namingRules: {
        routeStyle: "short operational harbor terms without generic payment words",
        fieldStyle: "snake_case",
        forbiddenCanonicalNames: ["payments", "customers", "balances", "account", "metrics", "profile"],
        examples: ["cargo-ledger", "dock-pass", "tide-stream", "operator-book"]
      },
      uiDirection: {
        layout: "split-workspace",
        density: "balanced",
        navigation: "command-rail",
        visualStyle: "split harbor operations workspace with copper surfaces",
        palette: ["copper", "steel", "tide blue", "white"],
        dashboardBlocks: ["metrics", "recentPayments", "balances", "createPayment"]
      },
      copy: {
        loginTitle: "Enter dock",
        registerTitle: "Issue dock pass",
        emptyStates: {
          payments: "No cargo clearings have been logged.",
          customers: "No operators are in the harbor book.",
          balances: "No tide stream movements are posted."
        },
        actionLabels: {
          createPayment: "Clear cargo",
          history: "Cargo ledger",
          refund: "Reverse cargo",
          overview: "Harbor board",
          payments: "Cargo clearings",
          customers: "Operator book",
          balances: "Tide stream"
        }
      },
      statusVocabulary: {
        created: "cargoLogged",
        settled: "cargoCleared"
      }
    });

    const validation = specService.validateSpec(spec);
    const routes = Object.values(spec.entities).map((entity) => entity.route);

    expect(validation.issues).toEqual([]);
    expect(routes).not.toContain("payments");
    expect(routes).not.toContain("customers");
    expect(routes).not.toContain("balances");
    expect(spec.resourceAlias).toBe("cargo_items");
    expect(spec.statuses.created).toBe("cargologged");
    expect(spec.ui.presentation.layout).toBe("split-workspace");
  });
});

