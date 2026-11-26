import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import {
  clampOffsets,
  coverScale,
  exportCroppedJpeg,
  loadHtmlImage,
  nextRotation,
  type RotationDeg,
} from "./crop-image";

export type AspectPreset = "catalog" | "square" | "portrait" | "free";

type ProductPhotoCropperProps = {
  source: string;
  fileName: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const ASPECT_OPTIONS: Array<{ id: AspectPreset; label: string }> = [
  { id: "catalog", label: "Vitrine 5:3" },
  { id: "square", label: "Carré" },
  { id: "portrait", label: "Portrait 4:5" },
  { id: "free", label: "Libre" },
];

export function ProductPhotoCropper({ source, fileName, onCancel, onConfirm }: ProductPhotoCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aspect, setAspect] = useState<AspectPreset>("catalog");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<RotationDeg>(0);
  const [flipH, setFlipH] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 560, height: 220 });
  const [frameHeight, setFrameHeight] = useState(220);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadHtmlImage(source)
      .then((loaded) => {
        if (!cancelled) {
          setImage(loaded);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : "Impossible de lire l’image.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  useEffect(() => {
    const fitChrome = () => {
      setFrameHeight(Math.min(280, Math.max(160, window.innerHeight - 300)));
    };
    fitChrome();
    window.addEventListener("resize", fitChrome);
    return () => window.removeEventListener("resize", fitChrome);
  }, []);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      setViewport({
        width: Math.max(200, node.clientWidth),
        height: Math.max(160, node.clientHeight),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [frameHeight, image]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }
    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => {
        const next = Math.min(4, Math.max(1, current + (event.deltaY < 0 ? 0.08 : -0.08)));
        return Number(next.toFixed(2));
      });
    };
    node.addEventListener("wheel", onWheelNative, { passive: false });
    return () => node.removeEventListener("wheel", onWheelNative);
  }, [image]);

  const imageRatio = image ? image.naturalWidth / image.naturalHeight : 5 / 3;
  const ratio = aspectValue(aspect, imageRatio);
  const stage = useMemo(() => fitStage(viewport, ratio), [ratio, viewport]);

  const scale = image ? coverScale(image.naturalWidth, image.naturalHeight, rotation, stage) * zoom : 1;

  useEffect(() => {
    if (!image) {
      return;
    }
    setOffset((current) => {
      const clamped = clampOffsets(
        current.x,
        current.y,
        image.naturalWidth,
        image.naturalHeight,
        rotation,
        zoom,
        stage,
      );
      if (clamped.offsetX === current.x && clamped.offsetY === current.y) {
        return current;
      }
      return { x: clamped.offsetX, y: clamped.offsetY };
    });
  }, [image, rotation, stage, zoom]);

  function applyOffset(nextX: number, nextY: number) {
    if (!image) {
      return;
    }
    const clamped = clampOffsets(nextX, nextY, image.naturalWidth, image.naturalHeight, rotation, zoom, stage);
    setOffset({ x: clamped.offsetX, y: clamped.offsetY });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    applyOffset(drag.ox + (event.clientX - drag.x), drag.oy + (event.clientY - drag.y));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function resetFrame() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function confirm() {
    if (!image) {
      return;
    }
    setBusy(true);
    setExportError(null);
    try {
      const blob = await exportCroppedJpeg(image, stage, {
        offsetX: offset.x,
        offsetY: offset.y,
        zoom,
        rotation,
        flipH,
      });
      const base = fileName.replace(/\.[^.]+$/, "") || "visuel";
      const file = new File([blob], `${base}.jpg`, { type: "image/jpeg" });
      onConfirm(file);
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : "Recadrage impossible.");
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-cropper-title"
        className="my-auto flex max-h-[min(92vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-black/50"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-2.5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Visuel</p>
            <h2 id="photo-cropper-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              Recadrer et arranger
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">Glissez pour cadrer, molette ou curseur pour zoomer.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            Fermer
          </button>
        </header>

        <div
          ref={frameRef}
          className="flex w-full shrink-0 items-center justify-center px-5 py-2"
          style={{ height: frameHeight }}
        >
          {loadError ? (
            <p className="rounded-xl border border-[var(--color-eyano-danger)]/30 bg-[var(--color-eyano-danger)]/10 px-4 py-3 text-sm text-red-200">
              {loadError}
            </p>
          ) : !image ? (
            <p className="text-sm text-slate-500">Préparation de l’image…</p>
          ) : (
            <div
              ref={stageRef}
              className="relative touch-none select-none overflow-hidden rounded-xl bg-slate-50 ring-2 ring-[var(--color-eyano-accent)]/50"
              style={{ width: stage.width, height: stage.height, cursor: "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={source}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  left: "50%",
                  top: "50%",
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                  marginLeft: -image.naturalWidth / 2,
                  marginTop: -image.naturalHeight / 2,
                  transformOrigin: "center center",
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${flipH ? -scale : scale}, ${scale})`,
                }}
              />
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(232,212,138,0.25)]" />
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-200 px-5 py-2.5">
          <div className="flex flex-wrap gap-2">
            {ASPECT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setAspect(option.id);
                  resetFrame();
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  aspect === option.id
                    ? "border-slate-300 bg-slate-100 text-slate-600"
                    : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Zoom {zoom.toFixed(2)}×</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-1.5 w-full accent-[var(--color-eyano-accent)]"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRotation((current) => nextRotation(current, -1));
                  resetFrame();
                }}
              >
                −90°
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRotation((current) => nextRotation(current, 1));
                  resetFrame();
                }}
              >
                +90°
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFlipH((current) => !current)}>
                Miroir
              </Button>
              <Button type="button" variant="ghost" onClick={resetFrame}>
                Réinitialiser
              </Button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                Annuler
              </Button>
              <Button type="button" onClick={() => void confirm()} disabled={!image || busy}>
                {busy ? "Export…" : "Appliquer"}
              </Button>
            </div>
          </div>
          {exportError ? <p className="text-sm text-red-300">{exportError}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function fitStage(viewport: { width: number; height: number }, ratio: number): { width: number; height: number } {
  const heightFromWidth = viewport.width / ratio;
  if (heightFromWidth <= viewport.height) {
    return { width: viewport.width, height: heightFromWidth };
  }
  return { width: viewport.height * ratio, height: viewport.height };
}

function aspectValue(preset: AspectPreset, imageRatio: number): number {
  switch (preset) {
    case "catalog":
      return 5 / 3;
    case "square":
      return 1;
    case "portrait":
      return 4 / 5;
    case "free":
      return imageRatio > 0 ? imageRatio : 5 / 3;
    default: {
      const unexpected: never = preset;
      return unexpected;
    }
  }
}
