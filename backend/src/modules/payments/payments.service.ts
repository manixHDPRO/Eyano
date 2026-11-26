import { HttpStatus, Injectable } from "@nestjs/common";
import { CurrencyCode, ExchangeRateType, PaymentMethod, Prisma } from "@prisma/client";
import { convertCdfToUsd, CDF_DECIMALS, moneyString, USD_DECIMALS } from "../../common/money";
import { ApiException } from "../../common/exceptions/api.exception";
import type { CreateSalePaymentDto } from "./dto/create-sale-payment.dto";
import { MOBILE_MONEY_METHODS, PAYMENTS_ERROR } from "./payments.constants";

type PrismaTx = Prisma.TransactionClient;

export type ResolvedPaymentLine = {
  method: PaymentMethod;
  currency: CurrencyCode;
  amount: string;
  amountUsd: string;
  exchangeRateId: string | null;
  rateSnapshot: string | null;
  providerReference: string | null;
};

export type OpenEncaissementRate = {
  id: string;
  rate: number;
};

@Injectable()
export class PaymentsService {
  async loadOpenEncaissementRate(tx: PrismaTx): Promise<OpenEncaissementRate> {
    const row = await tx.exchangeRate.findFirst({
      where: { rateType: ExchangeRateType.ENCAISSEMENT, validTo: null },
      orderBy: { validFrom: "desc" },
    });
    if (!row) {
      throw rateNotConfigured();
    }
    return { id: row.id, rate: Number(row.rate) };
  }

  resolvePaymentLines(
    inputs: CreateSalePaymentDto[],
    encaissement: OpenEncaissementRate,
  ): ResolvedPaymentLine[] {
    if (inputs.length === 0) {
      throw paymentsEmpty();
    }
    return inputs.map((input) => this.resolveOne(input, encaissement));
  }

  assertBalanced(saleTotalUsd: string, lines: ResolvedPaymentLine[]): void {
    const paid = lines.reduce((sum, line) => sum + Number(line.amountUsd), 0);
    if (moneyString(paid, USD_DECIMALS) !== moneyString(Number(saleTotalUsd), USD_DECIMALS)) {
      throw imbalance();
    }
  }

  async persist(tx: PrismaTx, saleId: string, lines: ResolvedPaymentLine[]): Promise<void> {
    for (const line of lines) {
      await tx.payment.create({
        data: {
          saleId,
          method: line.method,
          currency: line.currency,
          amount: line.amount,
          amountUsd: line.amountUsd,
          exchangeRateId: line.exchangeRateId,
          rateSnapshot: line.rateSnapshot,
          providerReference: line.providerReference,
        },
      });
    }
  }

  private resolveOne(input: CreateSalePaymentDto, encaissement: OpenEncaissementRate): ResolvedPaymentLine {
    if (MOBILE_MONEY_METHODS.includes(input.method as (typeof MOBILE_MONEY_METHODS)[number])) {
      const ref = input.providerReference?.trim();
      if (!ref) {
        throw referenceRequired();
      }
    }

    if (input.currency === CurrencyCode.USD) {
      const amount = moneyString(input.amount, USD_DECIMALS);
      return {
        method: input.method,
        currency: input.currency,
        amount,
        amountUsd: amount,
        exchangeRateId: null,
        rateSnapshot: null,
        providerReference: emptyToNull(input.providerReference),
      };
    }

    const amountCdf = moneyString(input.amount, CDF_DECIMALS);
    const amountUsd = convertCdfToUsd(Number(amountCdf), encaissement.rate);
    return {
      method: input.method,
      currency: CurrencyCode.CDF,
      amount: amountCdf,
      amountUsd,
      exchangeRateId: encaissement.id,
      rateSnapshot: moneyString(encaissement.rate, 6),
      providerReference: emptyToNull(input.providerReference),
    };
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function imbalance(): ApiException {
  return new ApiException(
    PAYMENTS_ERROR.IMBALANCE,
    "La somme des paiements ne couvre pas le total de la vente.",
    HttpStatus.CONFLICT,
  );
}

function referenceRequired(): ApiException {
  return new ApiException(
    PAYMENTS_ERROR.REFERENCE_REQUIRED,
    "Référence prestataire obligatoire pour le Mobile Money.",
    HttpStatus.BAD_REQUEST,
  );
}

function rateNotConfigured(): ApiException {
  return new ApiException(
    PAYMENTS_ERROR.RATE_NOT_CONFIGURED,
    "Taux d’encaissement non configuré.",
    HttpStatus.CONFLICT,
  );
}

function paymentsEmpty(): ApiException {
  return new ApiException(PAYMENTS_ERROR.EMPTY, "Au moins un paiement est requis.", HttpStatus.BAD_REQUEST);
}