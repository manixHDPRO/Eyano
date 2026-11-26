import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { FormSection } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/Toast";
import { generateProductBarcode, printBarcodes } from "../../lib/api/barcodes";
import { formatApiErrorMessage } from "../../lib/api/errors";
import type { BarcodeCatalogItem, ProductBarcode } from "../../lib/api/types";
import { BarcodeLabel } from "./BarcodeLabel";
import { BarcodePrintSheet } from "./BarcodePrintSheet";
import { waitThenPrint } from "./print-browser";

type ProductBarcodePanelProps = {
  productId: string;
  name: string;
  reference: string;
  price: number;
  barcode: ProductBarcode | null;
  canGenerate: boolean;
  canPrint: boolean;
};

export function ProductBarcodePanel({
  productId,
  name,
  reference,
  price,
  barcode,
  canGenerate,
  canPrint,
}: ProductBarcodePanelProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [printJob, setPrintJob] = useState<{ items: BarcodeCatalogItem[]; copies: number } | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => generateProductBarcode(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      pushToast({ tone: "success", message: "Code 128 attribué. Il ne sera plus régénéré." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Génération impossible.") });
    },
  });

  const printMutation = useMutation({
    mutationFn: () => printBarcodes({ productIds: [productId], copies: 1 }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["barcode-print-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      setPrintJob({ items: result.items, copies: result.copies });
      await waitThenPrint();
      pushToast({ tone: "success", message: "Impression journalisée. Choisissez l’imprimante dans le navigateur." });
    },
    onError: (caught) => {
      pushToast({ tone: "error", message: formatApiErrorMessage(caught, "Impression impossible.") });
    },
  });

  return (
    <>
      <FormSection
        title="Code-barres"
        description="Un code actif par article, symbologie Code 128. La réimpression conserve le même identifiant."
      >
        {barcode ? (
          <div className="space-y-4">
            <div className="mx-auto w-full max-w-[20.5rem]">
              <BarcodeLabel name={name} reference={reference} code={barcode.code} price={price} />
            </div>
            <div className="flex flex-wrap gap-2">
              {canPrint ? (
                <Button
                  type="button"
                  onClick={() => void printMutation.mutateAsync()}
                  disabled={printMutation.isPending}
                >
                  Imprimer l’étiquette
                </Button>
              ) : null}
              <Link
                to={`/admin/barcodes?productId=${productId}`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Atelier d’impression
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <p className="text-sm text-slate-600">Cet article n’a pas encore de code-barres.</p>
            {canGenerate ? (
              <Button
                type="button"
                className="mt-3"
                onClick={() => void generateMutation.mutateAsync()}
                disabled={generateMutation.isPending}
              >
                Générer le Code 128
              </Button>
            ) : (
              <p className="mt-2 text-xs text-slate-500">La génération est réservée au catalogue central.</p>
            )}
          </div>
        )}
      </FormSection>
      <BarcodePrintSheet job={printJob} />
    </>
  );
}
