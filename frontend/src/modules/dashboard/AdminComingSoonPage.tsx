import { Link, useParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { PageHeader } from "../../components/ui/PageHeader";
import { ALL_NAV_ITEMS_PREVIEW_LOOKUP } from "../../lib/navigation/admin-nav";

export function AdminComingSoonPage() {
  const { section } = useParams<{ section: string }>();
  const item = section ? ALL_NAV_ITEMS_PREVIEW_LOOKUP.get(section) : undefined;

  if (!item) {
    return (
      <div className="space-y-4">
        <PageHeader title="Section introuvable" description="Cette entrée de menu n’existe pas dans la configuration." />
        <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Module à venir"
        title={item.label}
        description={item.description ?? "Ce bloc métier sera livré dans un palier ultérieur, avec les mêmes garde-fous API."}
      />

      <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-8 text-center ">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
          Palier {item.palier ?? "—"}
        </p>
        <p className="mt-3 text-lg font-medium text-slate-900">En cours de conception</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          La navigation est déjà filtrée selon vos permissions. Les actions réelles seront activées lorsque les routes
          API correspondantes seront livrées.
        </p>
        <Link
          to="/admin"
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Tableau de bord
        </Link>
      </div>

      <Alert tone="info">
        Vous voyez cette page parce que votre compte dispose des droits nécessaires. Le masquage du menu n’est pas un
        contrôle de sécurité : chaque appel API reste vérifié côté serveur.
      </Alert>
    </div>
  );
}