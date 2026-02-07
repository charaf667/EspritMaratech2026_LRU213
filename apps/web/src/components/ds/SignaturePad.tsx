"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ds";
import { Undo2, Trash2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
}

interface SignaturePadProps {
  onSignatureChange: (svg: string | null) => void;
  className?: string;
}

function pointsToSvgPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    const cy = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function strokesToSvg(strokes: Stroke[], width: number, height: number): string {
  const paths = strokes
    .map((s) => pointsToSvgPath(s.points))
    .filter(Boolean)
    .map((d) => `<path d="${d}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${paths}</svg>`;
}

export default function SignaturePad({ onSignatureChange, className }: SignaturePadProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 200 });

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.max(180, Math.min(280, Math.floor(w * 0.55)));
      setCanvasSize({ w, h });
      canvas.width = w;
      canvas.height = h;
      redraw(strokes, []);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const redraw = useCallback((allStrokes: Stroke[], current: Point[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "var(--text-primary)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Use computed color
    const style = getComputedStyle(canvas);
    ctx.strokeStyle = style.getPropertyValue("--text-primary").trim() || "#000";

    const drawPoints = (points: Point[]) => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cx = (prev.x + curr.x) / 2;
        const cy = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    };

    allStrokes.forEach((s) => drawPoints(s.points));
    if (current.length > 0) drawPoints(current);
  }, []);

  useEffect(() => {
    redraw(strokes, currentStroke);
  }, [strokes, currentStroke, redraw]);

  const getPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke([pos]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentStroke((prev) => [...prev, pos]);
  }, [isDrawing]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length >= 2) {
      const newStrokes = [...strokes, { points: currentStroke }];
      setStrokes(newStrokes);
      const svg = strokesToSvg(newStrokes, canvasSize.w, canvasSize.h);
      onSignatureChange(svg);
    }
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, strokes, canvasSize, onSignatureChange]);

  const handleUndo = useCallback(() => {
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    onSignatureChange(newStrokes.length > 0 ? strokesToSvg(newStrokes, canvasSize.w, canvasSize.h) : null);
  }, [strokes, canvasSize, onSignatureChange]);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div className={cn("space-y-[var(--space-2)]", className)}>
      <label className="block text-sm font-medium text-[var(--text-primary)]">
        {t("attestationSignature")}
      </label>

      {/* Canvas container */}
      <div className="relative rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-primary)] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block w-full touch-none cursor-crosshair"
          style={{ height: `${canvasSize.h}px` }}
        />

        {/* Placeholder text */}
        {strokes.length === 0 && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-[var(--text-tertiary)] opacity-60">
              {t("attestationDrawHere")}
            </span>
          </div>
        )}

        {/* Baseline */}
        <div
          className="absolute bottom-[25%] start-[10%] end-[10%] h-px bg-[var(--border-subtle)] pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-[var(--space-2)]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Undo2 size={16} />}
          disabled={strokes.length === 0}
          onClick={handleUndo}
        >
          {t("attestationUndo")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Trash2 size={16} />}
          disabled={strokes.length === 0}
          onClick={handleClear}
        >
          {t("attestationClear")}
        </Button>
      </div>
    </div>
  );
}
