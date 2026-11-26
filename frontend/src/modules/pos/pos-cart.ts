export type PosCartLine = {
  productId: string;
  reference: string;
  name: string;
  barcode: string | null;
  officialPrice: number;
  discountPercent: number;
  finalUnitPrice: number;
  quantity: number;
  quantityAvailable: number | null;
};

export function cartSubtotal(lines: PosCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.officialPrice * line.quantity, 0);
}

export function cartDiscountTotal(lines: PosCartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + (line.officialPrice - line.finalUnitPrice) * line.quantity,
    0,
  );
}

export function cartTotal(lines: PosCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.finalUnitPrice * line.quantity, 0);
}

export function mergeCartLine(lines: PosCartLine[], incoming: PosCartLine): PosCartLine[] {
  const index = lines.findIndex((row) => row.productId === incoming.productId);
  if (index < 0) {
    return [...lines, incoming];
  }
  const copy = [...lines];
  const existing = copy[index];
  if (!existing) {
    return [...lines, incoming];
  }
  const nextQty = existing.quantity + incoming.quantity;
  const maxQty = existing.quantityAvailable;
  copy[index] = {
    ...existing,
    quantity: maxQty !== null ? Math.min(nextQty, maxQty) : nextQty,
  };
  return copy;
}