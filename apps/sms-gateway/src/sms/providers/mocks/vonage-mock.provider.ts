import { MockSmsProviderBase } from "../mock-provider.base.js";

export class VonageMockProvider extends MockSmsProviderBase {
  readonly name = "VonageMockProvider";

  canHandle(phoneNumber: string): boolean {
    return phoneNumber.startsWith("+49") || phoneNumber.startsWith("+33") || phoneNumber.startsWith("+44");
  }
}
