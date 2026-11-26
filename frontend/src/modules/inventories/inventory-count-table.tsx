import type { InventoryLine } from "../../lib/api/types";

const countedInputClass =
  "w-16 rounded border border-slate-300 px-2 py-1 text-right font-mono disabled:bg-slate-100";
const justificationInputClass =
  "w-full min-w-[140px] rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100";

export type CountDraft = Record<string, { physicalQty: string; justification: string }>;

export function InventoryCountTable({
  lines,
  countDraft,
  readOnly,
  onChange,
}: {
  lines: InventoryLine[];
  countDraft: CountDraft;
  readOnly: boolean;
  onChange: (productId: string, patch: Partial<{ physicalQty: string; justification: string }>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-2 font-medium">Produit</th>
            <th className="py-2 font-medium text-right">Initial</th>
            <th className="py-2 font-medium text-right">Entrées</th>
            <th className="py-2 font-medium text-right">Ventes/Sort.</th>
            <th className="py-2 font-medium text-right">Théorique</th>
            <th className="py-2 font-medium text-right">Compté</th>
            <th className="py-2 font-medium text-right">Écart</th>
            <th className="py-2 pl-3 font-medium">Justification</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((line) => (
            <InventoryCountRow
              key={line.id}
              line={line}
              draft={countDraft[line.productId]}
              readOnly={readOnly}
              onChange={(patch) => onChange(line.productId, patch)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryCountRow({
  line,
  draft,
  readOnly,
  onChange,
}: {
  line: InventoryLine;
  draft?: { physicalQty: string; justification: string };
  readOnly: boolean;
  onChange: (patch: Partial<{ physicalQty: string; justification: string }>) => void;
}) {
  const physicalRaw = draft?.physicalQty ?? "";
  const counted =
    physicalRaw === ""
      ? line.physicalQty ?? line.theoreticalQty
      : Number(physicalRaw);
  const theoretical = line.theoreticalQty;
  const variance = counted - theoretical;
  const inbound = line.receiptsQty + line.transfersInQty;
  const outbound = line.salesQty + line.transfersOutQty + line.internalIssuesQty;

  return (
    <tr className="text-slate-900">
      <td className="py-2.5 pr-2 font-medium text-slate-900">{line.productName}</td>
      <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">{line.initialQty}</td>
      <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">{inbound}</td>
      <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">{outbound}</td>
      <td className="py-2.5 text-right font-mono tabular-nums font-semibold">{theoretical}</td>
      <td className="py-2.5 text-right">
        {readOnly ? (
          <span className="font-mono tabular-nums">{line.physicalQty ?? theoretical}</span>
        ) : (
          <input
            type="number"
            min={0}
            step={1}
            value={physicalRaw === "" ? String(counted) : physicalRaw}
            onChange={(event) => onChange({ physicalQty: event.target.value })}
            className={countedInputClass}
            disabled={readOnly}
            aria-label={`Quantité comptée ${line.productReference}`}
          />
        )}
      </td>
      <td
        className={`py-2.5 text-right font-mono tabular-nums font-bold ${
          variance !== 0 ? "text-red-700" : "text-slate-500"
        }`}
      >
        {variance > 0 ? `+${variance}` : variance}
      </td>
      <td className="py-2.5 pl-3">
        {readOnly ? (
          <span className="text-slate-500">{line.justification ?? "—"}</span>
        ) : (
          <input
            type="text"
            value={draft?.justification ?? line.justification ?? ""}
            onChange={(event) => onChange({ justification: event.target.value })}
            placeholder={variance !== 0 ? "Obligatoire si écart" : "Optionnel"}
            className={justificationInputClass}
            disabled={readOnly}
          />
        )}
      </td>
    </tr>
  );
}

export function buildInventoryPatchPayload(
  items: InventoryLine[],
  countDraft: CountDraft,
): Array<{ productId: string; physicalQty: number; justification?: string | null }> {
  return items.map((line) => {
    const draft = countDraft[line.productId];
    const physicalQty =
      draft?.physicalQty === "" || draft?.physicalQty === undefined
        ? (line.physicalQty ?? line.theoreticalQty)
        : Number(draft.physicalQty);
    return {
      productId: line.productId,
      physicalQty,
      justification: draft?.justification?.trim() || null,
    };
  });
}