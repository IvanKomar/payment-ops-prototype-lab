import { MockSmsProviderBase } from "../mock-provider.base.js";

export class Fast2SmsMockProvider extends MockSmsProviderBase {
  readonly name = "Fast2SmsMockProvider";

  canHandle(phoneNumber: string): boolean {
    return phoneNumber.startsWith("+91");
  }
}
