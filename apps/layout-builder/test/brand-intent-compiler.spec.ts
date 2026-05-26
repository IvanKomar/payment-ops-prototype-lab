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
    expect(spec.entities.payments.route).not.toContain("ledger");
    expect(spec.resourceAlias).toBe("cargo_items");
    expect(spec.statuses.created).toBe("cargologged");
    expect(spec.ui.presentation.layout).toBe("split-workspace");
    expect(spec.ui.authExperience.form.fields.email.label).toBe("Operator email");
    expect(spec.ui.authExperience.form.fields.password.label).toBe("Dock key");
  });

  it("maps descriptive layout language into distinct visual patterns", () => {
    const baseIntent = {
      brandName: "PixelForge Relay",
      concept: {
        domain: "player asset exchange",
        audience: "competitive players",
        productMetaphor: "forge relay",
        authMetaphor: "loadout pass",
        paymentMetaphor: "artifact handoff",
        tone: "fast arcade operations",
        avoidWords: ["payments", "customers", "account"],
        preferredTerms: ["forge", "loadout", "artifact", "player", "socket", "charge"]
      },
      namingRules: {
        routeStyle: "abstract arcade verbs",
        fieldStyle: "kebab-case" as const,
        forbiddenCanonicalNames: ["payments", "customers", "balances", "account", "metrics"],
        examples: ["ignite-relay", "loadout-gate", "artifact-run"]
      },
      uiDirection: {
        layout: "card operations command board",
        density: "balanced",
        navigation: "command rail",
        visualStyle: "arcade card board",
        palette: ["graphite", "lime", "magenta", "cool white"],
        dashboardBlocks: ["metrics", "recentPayments", "customers", "createPayment"]
      },
      copy: {
        loginTitle: "Enter loadout",
        registerTitle: "Claim relay slot",
        emptyStates: {
          payments: "No artifact handoffs are active.",
          customers: "No players are linked yet.",
          balances: "No forge charges have posted."
        },
        actionLabels: {
          createPayment: "Send artifact",
          history: "Relay feed",
          refund: "Reverse handoff",
          payments: "Artifact handoffs",
          customers: "Player links",
          balances: "Forge charges",
          overview: "Forge board"
        }
      },
      statusVocabulary: {
        created: "queuedRune",
        settled: "handoffDone"
      }
    };

    const spec = new BrandIntentCompilerService().compile(baseIntent);

    expect(spec.ui.presentation.layout).toBe("card-operations");
    expect(spec.ui.presentation.navigationPattern).toBe("command-rail");
    expect(spec.ui.paymentsExperience.composition.activityPattern).toBe("table");
    expect(spec.ui.paymentsExperience.composition.metricsPlacement).toBe("right");
    expect(spec.ui.paymentsExperience.table.columns.map((column) => column.key)).toEqual(["reference", "customer", "amount", "status", "destination"]);
    expect(spec.ui.paymentsExperience.table.titlePlacement).toBe("table");
    expect(spec.ui.paymentsExperience.createPayment.placement).toBe("sidecar");
    expect(spec.ui.authExperience.form.modeControl).toBe("toggle");
    expect(spec.entities.payments.route).toBe("artifact-handoff-abstract");
  });
});
