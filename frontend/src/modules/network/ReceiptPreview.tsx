type ReceiptPreviewProps = {
  storeName: string;
  city?: string;
  header?: string;
  footer?: string;
};

export function ReceiptPreview({ storeName, city, header, footer }: ReceiptPreviewProps) {
  const title = header?.trim() || storeName.trim() || "Nom de la boutique";
  const closing = footer?.trim() || "Merci de votre visite";

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Aperçu ticket</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">80 mm · POS</p>
      </div>
      <div className="bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] px-4 py-6">
        <div className="mx-auto w-[210px] rounded-sm bg-[#f6ecd4] px-4 py-5 text-[#1b1408] shadow-[0_16px_36px_-12px_rgba(15,23,42,0.45)] ring-1 ring-black/5">
          <div className="border-b border-dashed border-[#1b1408]/25 pb-3 text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider">{title}</p>
            {city?.trim() ? <p className="mt-1 font-mono text-[10px] opacity-70">{city.trim()}</p> : null}
          </div>
          <div className="space-y-1.5 py-3 font-mono text-[10px]">
            <div className="flex justify-between gap-2">
              <span>Article exemple</span>
              <span>12.00</span>
            </div>
            <div className="flex justify-between opacity-70">
              <span>Qté 1</span>
              <span>USD</span>
            </div>
          </div>
          <div className="border-t border-dashed border-[#1b1408]/25 pt-3 font-mono text-[10px]">
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>12.00 USD</span>
            </div>
            <p className="mt-3 text-center text-[9px] leading-relaxed opacity-80">{closing}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
