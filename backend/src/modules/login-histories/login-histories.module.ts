import { Module } from "@nestjs/common";
import { LoginHistoriesController } from "./login-histories.controller";
import { LoginHistoriesService } from "./login-histories.service";

@Module({
  controllers: [LoginHistoriesController],
  providers: [LoginHistoriesService],
  exports: [LoginHistoriesService],
})
export class LoginHistoriesModule {}