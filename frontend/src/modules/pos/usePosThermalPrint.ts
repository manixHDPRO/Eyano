import { useEffect, useRef } from "react";

/** Lance window.print() après montage du portail thermique et signale la fin via afterprint. */
export function usePosThermalPrint(onPrinted: () => void, resetKey: string) {
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    const finish = () => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      onPrinted();
    };

    const onAfterPrint = () => finish();
    window.addEventListener("afterprint", onAfterPrint);

    const fallback = window.setTimeout(finish, 4000);
    const kickoff = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    }, 150);

    return () => {
      window.clearTimeout(kickoff);
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [onPrinted, resetKey]);
}