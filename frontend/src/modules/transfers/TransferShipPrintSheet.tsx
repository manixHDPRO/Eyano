import { EYANO_LOGO_ALT, EYANO_LOGO_SRC } from "../../lib/brand";
import type { TransferShipPrintPayload } from "./transfer-ship-print-data";
import { personName } from "./transfer-status";

type TransferShipPrintSheetProps = {
  payload: TransferShipPrintPayload;
};

export function TransferShipPrintSheet({ payload }: TransferShipPrintSheetProps) {
  const { detail } = payload;
  const printedAt = new Date(payload.generatedAt);
  const shippedAt = detail.shippedAt ? new Date(detail.shippedAt) : printedAt;
  const shippedLabel = shippedAt.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const printedLabel = printedAt.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="transfer-ship-print" lang="fr" aria-label="Fiche de transfert">
      <header className="transfer-ship-print__mast">
        <div className="transfer-ship-print__brand">
          <img src={EYANO_LOGO_SRC} alt={EYANO_LOGO_ALT} className="transfer-ship-print__logo" width={120} height={30} />
        </div>
        <div className="transfer-ship-print__doc-meta">
          <p className="transfer-ship-print__doc-ref">{detail.reference}</p>
          <p className="transfer-ship-print__doc-date">Expédition : {shippedLabel}</p>
        </div>
      </header>

      <section className="transfer-ship-print__title" aria-label="Titre">
        <h1>FICHE DE TRANSFERT</h1>
        <p>Document d&apos;accompagnement — signatures requises</p>
      </section>

      <section className="transfer-ship-print__route" aria-label="Itinéraire">
        <div className="transfer-ship-print__route-col">
          <p className="transfer-ship-print__route-label">Entrepôt expéditeur</p>
          <p className="transfer-ship-print__route-value">{detail.warehouse.name}</p>
          <p className="transfer-ship-print__route-sub">{detail.warehouse.code}</p>
        </div>
        <div className="transfer-ship-print__route-arrow" aria-hidden="true">
          →
        </div>
        <div className="transfer-ship-print__route-col">
          <p className="transfer-ship-print__route-label">Boutique destinataire</p>
          <p className="transfer-ship-print__route-value">{detail.store.name}</p>
          <p className="transfer-ship-print__route-sub">{detail.store.code}</p>
        </div>
      </section>

      {detail.note ? (
        <p className="transfer-ship-print__note">
          <span className="transfer-ship-print__note-label">Note :</span> {detail.note}
        </p>
      ) : null}

      <table className="transfer-ship-print__table">
        <thead>
          <tr>
            <th scope="col">Référence</th>
            <th scope="col">Désignation</th>
            <th scope="col" className="transfer-ship-print__num">
              Qté expédiée
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.items.map((line) => (
            <tr key={line.id}>
              <td className="transfer-ship-print__ref">{line.productReference}</td>
              <td className="transfer-ship-print__cell-name">{line.productName}</td>
              <td className="transfer-ship-print__num transfer-ship-print__num--strong">{line.quantityShipped}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="transfer-ship-print__total-label">
              Total articles expédiés
            </td>
            <td className="transfer-ship-print__num transfer-ship-print__num--strong">{detail.totalShipped}</td>
          </tr>
        </tfoot>
      </table>

      <section className="transfer-ship-print__signatures" aria-label="Signatures">
        <SignatureBlock role="Caissière" defaultName={null} />
        <SignatureBlock role="Témoin" defaultName={null} />
        <SignatureBlock role="Expéditeur" defaultName={personName(detail.shippedBy)} />
      </section>

      <footer className="transfer-ship-print__foot">
        <span>Eyano · Document interne</span>
        <span>Imprimé le {printedLabel}</span>
        <span>{detail.lineCount} ligne{detail.lineCount > 1 ? "s" : ""}</span>
      </footer>
    </article>
  );
}

function SignatureBlock(props: { role: string; defaultName: string | null }) {
  return (
    <div className="transfer-ship-print__signature">
      <p className="transfer-ship-print__signature-role">{props.role}</p>
      {props.defaultName ? <p className="transfer-ship-print__signature-name">{props.defaultName}</p> : null}
      <div className="transfer-ship-print__signature-line" aria-hidden="true" />
      <p className="transfer-ship-print__signature-hint">Nom et signature</p>
    </div>
  );
}