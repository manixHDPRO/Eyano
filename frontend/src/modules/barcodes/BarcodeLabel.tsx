import { EYANO_LOGO_ALT, EYANO_LOGO_SRC } from "../../lib/brand";
import { formatUsd } from "../catalog/money";
import { Code128Bars } from "./Code128Bars";

type BarcodeLabelVariant = "default" | "compact" | "sheet";

type BarcodeLabelProps = {
  name: string;
  reference: string;
  code: string;
  price: number;
  compact?: boolean;
  variant?: BarcodeLabelVariant;
};

export function BarcodeLabel({
  name,
  reference,
  code,
  price,
  compact = false,
  variant: variantProp,
}: BarcodeLabelProps) {
  const variant: BarcodeLabelVariant = variantProp ?? (compact ? "compact" : "default");

  if (variant === "sheet") {
    return (
      <article className="barcode-label-sheet print-surface">
        <div className="barcode-label-sheet__bars">
          <Code128Bars code={code} height={8} className="barcode-label-sheet__svg" />
        </div>
        <p className="barcode-label-sheet__code">{code}</p>
      </article>
    );
  }

  const isCompact = variant === "compact";

  return (
    <article
      className={`print-surface flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-[#001428] shadow-sm ${
        isCompact ? "p-2.5" : "p-3"
      }`}
    >
      <header className="flex items-center justify-between gap-2">
        <img
          src={EYANO_LOGO_SRC}
          alt={EYANO_LOGO_ALT}
          className={`w-auto shrink-0 object-contain object-left ${isCompact ? "h-5 max-w-[4.5rem]" : "h-6 max-w-[5.5rem]"}`}
          width={88}
          height={24}
        />
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Code 128</span>
      </header>
      <h3
        className={`mt-1.5 font-semibold leading-tight text-[#002147] ${isCompact ? "line-clamp-2 text-[11px]" : "line-clamp-2 text-sm"}`}
      >
        {name}
      </h3>
      <div className={`mt-2 shrink-0 overflow-hidden rounded-sm bg-white ${isCompact ? "h-9" : "h-12"}`}>
        <Code128Bars code={code} height={isCompact ? 36 : 48} className={isCompact ? "h-9" : "h-12"} />
      </div>
      <p
        className={`relative z-10 mt-1.5 text-center font-mono font-semibold tracking-[0.16em] text-[#001428] ${
          isCompact ? "text-[10px]" : "text-xs"
        }`}
      >
        {code}
      </p>
      <footer className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-1.5">
        <span className="truncate font-mono text-[10px] tracking-wide text-slate-500">{reference}</span>
        <span className={`font-semibold tabular-nums ${isCompact ? "text-[11px]" : "text-sm"}`}>{formatUsd(price)}</span>
      </footer>
    </article>
  );
}
