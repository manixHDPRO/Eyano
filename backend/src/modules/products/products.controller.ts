import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CurrentRequestMeta } from "../../common/decorators/request-meta.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import type { RequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { CreateProductDto } from "./dto/create-product.dto";
import { ListProductsQueryDto } from "./dto/list-products.query.dto";
import { SetProductStoresDto } from "./dto/set-product-stores.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { PRODUCT_PHOTO_MAX_BYTES } from "./products.constants";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission(["products.manage", "products.read"])
  list(@CurrentUser() actor: AuthUser, @Query() query: ListProductsQueryDto) {
    return this.products.list(actor, query);
  }

  @Get(":id")
  @RequirePermission(["products.manage", "products.read"])
  findOne(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.products.findOne(actor, id);
  }

  @Get(":id/stores")
  @RequirePermission(["products.manage", "products.read"])
  listStores(@CurrentUser() actor: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.products.listStoreAuthorizations(actor, id);
  }

  @Put(":id/stores")
  @RequirePermission("products.manage")
  setStores(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetProductStoresDto,
  ) {
    return this.products.setStoreAuthorizations(actor, id, dto, meta);
  }

  @Post()
  @RequirePermission("products.manage")
  create(@CurrentUser() actor: AuthUser, @CurrentRequestMeta() meta: RequestMeta, @Body() dto: CreateProductDto) {
    return this.products.create(actor, dto, meta);
  }

  @Patch(":id")
  @RequirePermission("products.manage")
  update(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(actor, id, dto, meta);
  }

  @Post(":id/photo")
  @RequirePermission("products.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: PRODUCT_PHOTO_MAX_BYTES },
    }),
  )
  setPhoto(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.products.setPhoto(actor, id, file, meta);
  }

  @Delete(":id")
  @RequirePermission("products.manage")
  remove(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.products.remove(actor, id, meta);
  }

  @Delete(":id/photo")
  @RequirePermission("products.manage")
  clearPhoto(
    @CurrentUser() actor: AuthUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.products.clearPhoto(actor, id, meta);
  }
}
