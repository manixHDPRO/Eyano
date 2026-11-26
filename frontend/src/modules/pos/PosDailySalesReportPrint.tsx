import { createPortal } from "react-dom";
import type { PosDailySalesReport } from "../../lib/api/types";
import { PosDailySalesReportPrintSheet } from "./PosDailySalesReportPrintSheet";
import { usePosThermalPrint } from "./usePosThermalPrint";

type PosDailySalesReportPrintProps = {
  report: PosDailySalesReport;
  onPrinted: () => void;
};

export function PosDailySalesReportPrint({ report, onPrinted }: PosDailySalesReportPrintProps) {
  usePosThermalPrint(onPrinted, `${report.reportDate}-${report.generatedAt}`);

  return createPortal(
    <div id="eyano-pos-daily-report-print" className="pos-daily-report-print-root">
      <PosDailySalesReportPrintSheet report={report} />
    </div>,
    document.body,
  );
}