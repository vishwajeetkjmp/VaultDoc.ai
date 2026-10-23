"use client";

import { useState } from "react";
import styles from "./tools.module.css";

/** Moves an item from one index to another (used by drag-and-drop and the arrow buttons). */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Shared drag state for a grid of tiles. */
export function useDragOrder(onMove: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const props = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index)); // needed for Firefox
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragging === null) return;
      e.preventDefault();
      setOver(index);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging !== null) onMove(dragging, index);
      setDragging(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });
  return { dragging, over, props };
}

const icon = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const ICONS = {
  left: icon("m15 6-6 6 6 6"),
  right: icon("m9 6 6 6-6 6"),
  rotate: icon("M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"),
  remove: icon("M6 6l12 12M18 6 6 18"),
};

export type TileAction = { label: string; icon: React.ReactNode; onClick: () => void };

/** A thumbnail card in a reorderable grid. */
export function Tile({
  index,
  total,
  image,
  rotation = 0,
  label,
  sublabel,
  badge,
  actions,
  selected,
  dimmed,
  onMove,
  onClick,
  drag,
}: {
  index: number;
  total: number;
  image: string | null;
  rotation?: number;
  label: string;
  sublabel?: string;
  badge?: string;
  actions: TileAction[];
  selected?: boolean;
  dimmed?: boolean;
  onMove: (from: number, to: number) => void;
  onClick?: () => void;
  drag: ReturnType<typeof useDragOrder>;
}) {
  const className = [
    styles.tile,
    drag.dragging === index && styles.tileDragging,
    drag.over === index && drag.dragging !== index && styles.tileOver,
    selected && styles.tileSelected,
    dimmed && styles.tileRemoved,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} {...drag.props(index)} onClick={onClick} role={onClick ? "button" : undefined} aria-pressed={onClick ? selected : undefined}>
      <div className={styles.thumb}>
        {image ? (
          // Sideways pages are shrunk to 3/4 so they still fit the 3:4 frame
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" style={{ transform: `rotate(${rotation}deg)${rotation % 180 ? " scale(0.75)" : ""}` }} draggable={false} />
        ) : (
          <div className={styles.thumbPlaceholder} />
        )}
      </div>
      {badge && <span className={styles.pageNumber}>{badge}</span>}
      <div className={styles.tileTools} onClick={(e) => e.stopPropagation()}>
        {index > 0 && (
          <button className={styles.iconButton} onClick={() => onMove(index, index - 1)} aria-label={`Move ${label} earlier`} title="Move earlier">
            {ICONS.left}
          </button>
        )}
        {index < total - 1 && (
          <button className={styles.iconButton} onClick={() => onMove(index, index + 1)} aria-label={`Move ${label} later`} title="Move later">
            {ICONS.right}
          </button>
        )}
        {actions.map((a) => (
          <button key={a.label} className={styles.iconButton} onClick={a.onClick} aria-label={`${a.label} ${label}`} title={a.label}>
            {a.icon}
          </button>
        ))}
      </div>
      <div className={styles.tileLabel}>
        <span className={styles.tileName} title={label}>
          {label}
        </span>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  );
}
