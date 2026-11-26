import { Link } from "react-router-dom";
import { TransfersListPage } from "../transfers/TransfersListPage";

export function PosTransfersReceivePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 md:px-6">
      <Link
        to="/pos"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden>←</span>
        Retour à la caisse
      </Link>
      <TransfersListPage posReceiveMode />
    </main>
  );
}