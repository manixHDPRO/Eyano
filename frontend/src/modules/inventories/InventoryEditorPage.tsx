import { Navigate, useParams } from "react-router-dom";

/** Compatibilité liens profonds : la liste HD intègre l’éditeur en panneau droit. */
export function InventoryEditorPage() {
  const { id } = useParams();
  if (!id || id === "new") {
    return <Navigate to="/admin/inventories" replace />;
  }
  return <Navigate to={`/admin/inventories/${id}`} replace />;
}