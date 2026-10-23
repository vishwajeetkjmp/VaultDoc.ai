"use client";

import { useMemo, useRef, useState } from "react";

type Point = { day: string; value: number };

const W = 640;
const PAD = { top: 12, right: 8, bottom: 30, left: 56 };

/** Rounds the top of the axis to a readable number (1, 2, 2.5, 5 × 10ⁿ). */
function niceMax(v: number) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * One series over the last 30 days: thin rounded bars (counts per day) or a line (running totals).
 * Single series, so no legend (the card title names it); faint gridlines; hover shows the exact
 * value, with hit areas wider than the marks.
 */
export default function TimeChart({
  points,
  kind = "bar",
  height = 180,
  format = (n) => String(n),
  label,
}: {
  points: Point[];
  kind?: "bar" | "line";
  height?: number;
  format?: (n: number) => string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = useMemo(() => niceMax(Math.max(0, ...points.map((p) => p.value))), [points]);
  const step = plotW / Math.max(1, points.length);
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  const barW = Math.max(2, Math.min(18, step - 2)); // 2px gap between neighbouring bars
  const bar = (i: number, v: number) => {
    const h = Math.max(v > 0 ? 2 : 0, (v / max) * plotH);
    const left = x(i) - barW / 2;
    const top = PAD.top + plotH - h;
    const r = Math.min(4, barW / 2, h); // rounded data end, square at the baseline
    return `M${left},${PAD.top + plotH}V${top + r}Q${left},${top} ${left + r},${top}H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${PAD.top + plotH}Z`;
  };
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join("");
  const total = points.reduce((s, p) => s + p.value, 0);

  if (!points.length) return <div className="empty small">No data yet</div>;

  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, last ${points.length} days`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--faint)">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
            <text key={p.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--faint)">
              {dayLabel(p.day)}
            </text>
          ) : null,
        )}
        {kind === "bar" ? (
          points.map((p, i) => <path key={p.day} d={bar(i, p.value)} fill="var(--chart)" opacity={hover === null || hover === i ? 1 : 0.45} />)
        ) : (
          <>
            <path d={`${line}L${x(points.length - 1)},${PAD.top + plotH}L${x(0)},${PAD.top + plotH}Z`} fill="var(--chart)" opacity={0.1} />
            <path d={line} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--faint)" strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(points[hover].value)} r={4.5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
              </>
            )}
          </>
        )}
        {/* Hit areas: a full-height column per day, wider than the bar */}
        {points.map((p, i) => (
          <rect key={`hit-${p.day}`} x={PAD.left + step * i} y={PAD.top} width={step} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="chartTip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%` }}>
          {dayLabel(points[hover].day)} · <b>{format(points[hover].value)}</b>
        </div>
      )}
      {kind === "bar" && (
        <div className="muted small" style={{ marginTop: 4 }}>
          {format(total)} in the last {points.length} days
        </div>
      )}
    </div>
  );
}
