import { computeFinalPrice, computeDiscountAmount, convertCdfToUsd, convertUsdToCdf, moneyString, roundHalfUp } from "./money";

describe("money", () => {
  describe("computeFinalPrice", () => {
    it("applique la remise et arrondit à deux décimales (USD)", () => {
      expect(computeFinalPrice(50, 20)).toBe("40.00");
      expect(computeFinalPrice(10, 0)).toBe("10.00");
      expect(computeFinalPrice(50, 100)).toBe("0.00");
      expect(computeFinalPrice(8, 100)).toBe("0.00");
    });
  });

  describe("computeDiscountAmount", () => {
    it("calcule le montant de remise unitaire affiché", () => {
      expect(computeDiscountAmount(50, 20)).toBe("10.00");
      expect(computeDiscountAmount(50, 0)).toBe("0.00");
    });
  });

  describe("roundHalfUp", () => {
    it("arrondit le CDF sans décimale", () => {
      expect(roundHalfUp(1234.6, 0)).toBe(1235);
      expect(moneyString(99.995, 0)).toBe("100");
    });
  });

  describe("change encaissement", () => {
    it("convertit CDF ↔ USD au taux du cahier", () => {
      expect(convertCdfToUsd(2_400_000, 24_000)).toBe("100.00");
      expect(convertUsdToCdf(50, 24_000)).toBe("1200000");
    });
  });
});