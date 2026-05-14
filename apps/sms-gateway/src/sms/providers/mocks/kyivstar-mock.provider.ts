import { MockSmsProviderBase } from "../mock-provider.base.js";

export class KyivstarMockProvider extends MockSmsProviderBase {
  readonly name = "KyivstarMockProvider";

  canHandle(phoneNumber: string): boolean {
    return phoneNumber.startsWith("+380");
  }
}
