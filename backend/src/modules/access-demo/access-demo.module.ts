import { Module } from "@nestjs/common";
import { AccessDemoController } from "./access-demo.controller";

@Module({
  controllers: [AccessDemoController],
})
export class AccessDemoModule {}