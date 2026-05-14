import { Inject, Injectable } from "@nestjs/common";

import type { SmsGatewayEnv } from "../../config/env.schema.js";
import { SMS_GATEWAY_CONFIG } from "../sms.constants.js";
import { Fast2SmsProvider } from "./fast2sms.provider.js";
import { Fast2SmsMockProvider } from "./mocks/fast2sms-mock.provider.js";
import { KyivstarMockProvider } from "./mocks/kyivstar-mock.provider.js";
import { TwilioMockProvider } from "./mocks/twilio-mock.provider.js";
import { VonageMockProvider } from "./mocks/vonage-mock.provider.js";
import type { ISmsProvider, MockSmsProviderConfig } from "./provider.types.js";

@Injectable()
export class ProviderRegistry {
  private readonly providers: ISmsProvider[];

  constructor(@Inject(SMS_GATEWAY_CONFIG) private readonly config: SmsGatewayEnv) {
    this.providers = this.createProviders();
  }

  selectProvider(phoneNumber: string): ISmsProvider {
    // TwilioMockProvider is the global catch-all route, so every valid E.164 number has a provider.
    return this.providers.find((provider) => provider.canHandle(phoneNumber)) ?? this.getRequiredProvider("TwilioMockProvider");
  }

  getProvider(name: string): ISmsProvider {
    return this.getRequiredProvider(name);
  }

  getFallbackProviders(phoneNumber: string, failedProviderNames: Set<string>): ISmsProvider[] {
    const selectedProvider = this.selectProvider(phoneNumber);
    const preferredOrder = [
      selectedProvider.name,
      "VonageMockProvider",
      "TwilioMockProvider",
      ...this.providers.map((provider) => provider.name)
    ];
    const orderedNames = [...new Set(preferredOrder)];

    return orderedNames
      .filter((name) => !failedProviderNames.has(name))
      .map((name) => this.providers.find((provider) => provider.name === name))
      .filter((provider): provider is ISmsProvider => provider !== undefined);
  }

  private createProviders(): ISmsProvider[] {
    const mockConfig: MockSmsProviderConfig = {
      successRate: this.config.SMS_MOCK_SUCCESS_RATE,
      minLatencyMs: this.config.SMS_MOCK_MIN_LATENCY_MS,
      maxLatencyMs: this.config.SMS_MOCK_MAX_LATENCY_MS
    };

    return [
      new KyivstarMockProvider(mockConfig),
      this.createIndiaProvider(mockConfig),
      new VonageMockProvider(mockConfig),
      new TwilioMockProvider(mockConfig)
    ];
  }

  private createIndiaProvider(mockConfig: MockSmsProviderConfig): ISmsProvider {
    if (this.config.FAST2SMS_ENABLED && this.config.FAST2SMS_API_KEY) {
      return new Fast2SmsProvider({
        apiKey: this.config.FAST2SMS_API_KEY
      });
    }

    return new Fast2SmsMockProvider(mockConfig);
  }

  private getRequiredProvider(name: string): ISmsProvider {
    const provider = this.providers.find((candidate) => candidate.name === name);

    if (!provider) {
      throw new Error(`SMS provider is not registered: ${name}`);
    }

    return provider;
  }
}
