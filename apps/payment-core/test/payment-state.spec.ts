import { assertPaymentTransition, canTransition, initialStatusForScenario } from "../src/payments/payment-state.js";

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
});
