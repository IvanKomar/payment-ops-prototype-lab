import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type * as PrismaClientModule from "@prisma/client";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client") as typeof PrismaClientModule;

@Injectable()
export class PrismaService extends PrismaClient implements PrismaClientType, OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
