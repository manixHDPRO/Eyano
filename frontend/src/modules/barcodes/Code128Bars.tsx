import { useMemo } from "react";
import { code128BarRects, isCode128BText } from "../../lib/barcode/code128";

type Code128BarsProps = {
  code: string;
  className?: string;
  height?: number;
};

export function Code128Bars({ code, className = "", height = 64 }: Code128BarsProps) {
  const encoded = useMemo(() => {
    if (!isCode128BText(code)) {
      return null;
    }
    try {
      return code128BarRects(code);
    } catch {
      return null;
    }
  }, [code]);

  if (!encoded) {
    return (
      <div className={`grid place-items-center bg-white text-xs text-slate-400 ${className}`}>
        Code 128 illisible
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label={`Code 128 ${code}`}
      viewBox={`0 0 ${encoded.moduleCount} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
    >
      <rect width={encoded.moduleCount} height={height} fill="#ffffff" />
      {encoded.bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={height} fill="#001428" />
      ))}
    </svg>
  );
}
