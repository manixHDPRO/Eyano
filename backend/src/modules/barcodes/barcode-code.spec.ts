import { generateBarcodePayload, isCode128BCompatible, isGeneratedBarcodeFormat, normalizeBarcodeCode } from "./barcode-code";

describe("barcode-code", () => {
  it("émet un payload Code 128-B au format EY + 6 chiffres", () => {
    const code = generateBarcodePayload();
    expect(isGeneratedBarcodeFormat(code)).toBe(true);
    expect(isCode128BCompatible(code)).toBe(true);
  });

  it("refuse les caractères hors subset B", () => {
    expect(isCode128BCompatible("EY123")).toBe(true);
    expect(isCode128BCompatible("AB\u0001")).toBe(false);
    expect(isCode128BCompatible("")).toBe(false);
  });

  it("normalise la recherche (casse et espaces)", () => {
    expect(normalizeBarcodeCode("  ey000001 ")).toBe("EY000001");
  });

  it("retire les caractères de contrôle des scanners", () => {
    expect(normalizeBarcodeCode("EY000001\r\n")).toBe("EY000001");
    expect(normalizeBarcodeCode("\u001dEY000001")).toBe("EY000001");
  });

  it("produit des codes distincts sur un échantillon", () => {
    const codes = new Set(Array.from({ length: 40 }, () => generateBarcodePayload()));
    expect(codes.size).toBe(40);
  });
});
