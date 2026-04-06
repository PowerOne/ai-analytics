import { Global, Module } from "@nestjs/common";
import { AiInternalClient } from "./ai-internal.client";

@Global()
@Module({
  providers: [AiInternalClient],
  exports: [AiInternalClient],
})
export class IntegrationsModule {}
