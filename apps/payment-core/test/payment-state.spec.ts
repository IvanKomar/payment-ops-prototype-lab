import { assertPaymentTransition, canTransition, initialStatusForScenario } from "../src/payments/payment-state.js";
import { createPaymentSchema } from "../src/payments/dto/payment.schemas.js";

describe("payment state machine", () => {
  it("allows the intended happy-path transitions", () => {
    expect(canTransition("created", "requires_confirmation")).toBe(true);
    expect(canTransition("requires_confirmation", "processing")).toBe(true);
    expect(canTransition("processing", "authorized")).toBe(true);
    expect(canTransition("authorized", "captured")).toBe(true);
    expect(canTransition("captured", "settled")).toBe(true);
    expect(canTransition("settled", "refunded")).toBe(true);
  });

  it("blocks invalid terminal transitions", () => {
    expect(() => assertPaymentTransition("refunded", "captured")).toThrow(
      "Invalid payment transition: refunded -> captured"
    );
    expect(() => assertPaymentTransition("failed", "processing")).toThrow(
      "Invalid payment transition: failed -> processing"
    );
  });

  it("supports deterministic local simulation scenarios", () => {
    expect(
      initialStatusForScenario({
        paymentId: "pay_1",
        destinationLabel: "fail-demo-address"
      })
    ).toBe("failed");
    expect(
      initialStatusForScenario({
        paymentId: "pay_2",
        destinationLabel: "review-demo-address"
      })
    ).toBe("processing");
    expect(
      initialStatusForScenario({
        paymentId: "pay_3",
        destinationLabel: "settle-demo-address"
      })
    ).toBe("settled");
  });

  it("supports explicit seed scenarios for every prototype status", () => {
    const scenarios = [
      "created",
      "requires_payment_method",
      "requires_confirmation",
      "processing",
      "authorized",
      "captured",
      "settled",
      "failed",
      "canceled",
      "refunded"
    ] as const;

    for (const scenario of scenarios) {
      expect(
        initialStatusForScenario({
          paymentId: "pay_seed",
          destinationLabel: "seeded payment",
          scenario
        })
      ).toBe(scenario);
    }
  });

  it("accepts structured customer and payment method input", () => {
    const result = createPaymentSchema.parse({
      amount: "49.99",
      currency: "usd",
      customer: {
        email: "Ava@Example.com",
        name: "Ava Customer"
      },
      paymentMethod: {
        brand: "visa",
        last4: "4242",
        type: "card"
      },
      scenario: "settle"
    });

    expect(result.customer?.email).toBe("ava@example.com");
    expect(result.methodType).toBe("card");
    expect(result.paymentMethod?.last4).toBe("4242");
  });
});
