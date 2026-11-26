import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";

@Module({
  imports: [AccessModule],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}