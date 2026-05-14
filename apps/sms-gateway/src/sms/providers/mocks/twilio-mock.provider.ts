import { MockSmsProviderBase } from "../mock-provider.base.js";

export class TwilioMockProvider extends MockSmsProviderBase {
  readonly name = "TwilioMockProvider";

  canHandle(): boolean {
    return true;
  }
}
