import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { ApiException } from "../../common/exceptions/api.exception";
import { ensureUploadDirectories, resolveUploadRoot } from "../../common/uploads/upload-root";
import { PRODUCT_PHOTO_MAX_BYTES, PRODUCT_PHOTO_MIME, PRODUCTS_ERROR } from "./products.constants";

const EXTENSION_BY_MIME: Record<(typeof PRODUCT_PHOTO_MIME)[number], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

@Injectable()
export class ProductPhotosService {
  private readonly uploadRoot: string;

  constructor(config: ConfigService) {
    this.uploadRoot = resolveUploadRoot(config.get<string>("UPLOAD_DIR"));
    ensureUploadDirectories(this.uploadRoot);
  }

  async store(productId: string, file: Express.Multer.File, previousPath: string | null): Promise<string> {
    if (!file) {
      throw new ApiException(PRODUCTS_ERROR.PHOTO_REQUIRED, "Ajoutez une image (JPEG, PNG ou WebP).", HttpStatus.BAD_REQUEST);
    }
    if (file.size > PRODUCT_PHOTO_MAX_BYTES) {
      throw new ApiException(
        PRODUCTS_ERROR.PHOTO_TOO_LARGE,
        "L’image dépasse 2 Mo.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const mime = file.mimetype as (typeof PRODUCT_PHOTO_MIME)[number];
    if (!PRODUCT_PHOTO_MIME.includes(mime)) {
      throw new ApiException(
        PRODUCTS_ERROR.PHOTO_INVALID,
        "Format refusé. Utilisez JPEG, PNG ou WebP.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const extension = EXTENSION_BY_MIME[mime] ?? extname(file.originalname).toLowerCase();
    const relative = `products/${productId}${extension}`;
    const absolute = join(this.uploadRoot, relative);
    await writeFile(absolute, file.buffer);
    if (previousPath && previousPath !== relative) {
      await this.remove(previousPath);
    }
    return relative;
  }

  async remove(photoPath: string | null): Promise<void> {
    if (!photoPath) {
      return;
    }
    const absolute = join(this.uploadRoot, photoPath);
    try {
      await unlink(absolute);
    } catch {
      // Fichier déjà absent : la fiche reste cohérente.
    }
  }

  toPublicUrl(photoPath: string | null): string | null {
    if (!photoPath) {
      return null;
    }
    return `/uploads/${photoPath.replace(/^\/+/, "")}`;
  }
}
