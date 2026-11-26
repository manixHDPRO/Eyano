import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { ApiException } from "../../common/exceptions/api.exception";
import { ensureUploadDirectories, resolveUploadRoot } from "../../common/uploads/upload-root";
import { EXPENSE_ERROR, EXPENSE_RECEIPT_MAX_BYTES, EXPENSE_RECEIPT_MIME } from "./expenses.constants";

const EXTENSION_BY_MIME: Record<(typeof EXPENSE_RECEIPT_MIME)[number], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

@Injectable()
export class ExpenseReceiptsService {
  private readonly uploadRoot: string;

  constructor(config: ConfigService) {
    this.uploadRoot = resolveUploadRoot(config.get<string>("UPLOAD_DIR"));
    ensureUploadDirectories(this.uploadRoot);
  }

  async store(expenseId: string, file: Express.Multer.File, previousPath: string | null): Promise<string> {
    if (!file) {
      throw new ApiException(
        EXPENSE_ERROR.RECEIPT_REQUIRED,
        "Ajoutez un justificatif (JPEG, PNG, WebP ou PDF).",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (file.size > EXPENSE_RECEIPT_MAX_BYTES) {
      throw new ApiException(
        EXPENSE_ERROR.RECEIPT_TOO_LARGE,
        "Le justificatif dépasse 5 Mo.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const mime = file.mimetype as (typeof EXPENSE_RECEIPT_MIME)[number];
    if (!EXPENSE_RECEIPT_MIME.includes(mime)) {
      throw new ApiException(
        EXPENSE_ERROR.RECEIPT_INVALID,
        "Format refusé. Utilisez JPEG, PNG, WebP ou PDF.",
        HttpStatus.BAD_REQUEST,
      );
    }
    const extension = EXTENSION_BY_MIME[mime] ?? extname(file.originalname).toLowerCase();
    const relative = `expenses/${expenseId}${extension}`;
    const absolute = join(this.uploadRoot, relative);
    await writeFile(absolute, file.buffer);
    if (previousPath && previousPath !== relative) {
      await this.remove(previousPath);
    }
    return relative;
  }

  async remove(receiptPath: string | null): Promise<void> {
    if (!receiptPath) {
      return;
    }
    const absolute = join(this.uploadRoot, receiptPath);
    try {
      await unlink(absolute);
    } catch {
      // Fichier déjà absent.
    }
  }

  toPublicUrl(receiptPath: string | null): string | null {
    if (!receiptPath) {
      return null;
    }
    return `/uploads/${receiptPath.replace(/^\/+/, "")}`;
  }
}