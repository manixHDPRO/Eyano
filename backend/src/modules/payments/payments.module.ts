import { Module } from "@nestjs/common";
import { AccessModule } from "../../common/access/access.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsListService } from "./payments-list.service";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsListService],
  exports: [PaymentsService],
})
export class PaymentsModule {}