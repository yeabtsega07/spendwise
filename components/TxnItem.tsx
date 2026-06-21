"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatMoney } from "@/lib/currency";
import { categoryColor, categoryIcon, LOAN_COLOR } from "@/lib/categories";
import { shortDate } from "@/lib/dates";
import type { Txn } from "@/lib/types";
import Icon from "./Icon";

interface Props {
  txn: Txn;
  onDelete: (id: string) => void;
  onEdit?: (t: Txn) => void;
  showSettle?: boolean;
  onToggleSettle?: (id: string) => void;
}

export default function TxnItem({ txn, onDelete, onEdit, showSettle, onToggleSettle }: Props) {
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    moved.current = false;
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const d = e.clientX - startX.current;
    if (!swiping && Math.abs(d) > 6) {
      setSwiping(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    if (Math.abs(d) > 6) {
      moved.current = true;
      setDx(Math.max(-120, Math.min(0, d)));
    }
  }
  function onPointerUp() {
    startX.current = null;
    if (dx < -70) onDelete(txn.id);
    setDx(0);
    setSwiping(false);
  }
  function onClick() {
    if (moved.current) {
      moved.current = false;
      return;
    }
    onEdit?.(txn);
  }

  const iconName = txn.kind === "loan" ? "coins" : categoryIcon(txn.category);
  const color = txn.kind === "loan" ? LOAN_COLOR : categoryColor(txn.category);
  const title = txn.kind === "loan" ? `Lent to ${txn.person || "someone"}` : txn.note;

  const meta: string[] = [];
  if (txn.kind === "expense") meta.push(txn.category || "Other");
  if (txn.kind === "loan" && txn.note) meta.push(txn.note);
  meta.push(shortDate(txn.date));
  if (txn.kind === "loan" && txn.settled) meta.push("repaid ✓");

  return (
    <li className="txn-row">
      {dx < 0 && (
        <div className="txn-row-bg">
          <Icon name="trash" size={17} />
          <span>Delete</span>
        </div>
      )}
      <div
        className={`txn-item ${txn.settled ? "is-settled" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: swiping ? "none" : "transform 0.22s" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      >
        <span
          className="txn-emoji"
          style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}33` }}
        >
          <Icon name={iconName} size={21} />
        </span>
        <div className="txn-body">
          <div className="txn-note">{title}</div>
          <div className="txn-meta">{meta.join(" · ")}</div>
        </div>
        <span className={txn.kind === "loan" ? "txn-amount lent" : "txn-amount"}>
          {formatMoney(txn.amount, txn.currency)}
        </span>
        {showSettle && onToggleSettle && (
          <button
            className={`settle-btn ${txn.settled ? "settled" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSettle(txn.id);
            }}
          >
            {txn.settled ? "Undo" : "Repaid"}
          </button>
        )}
        <button
          className="txn-del"
          aria-label="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(txn.id);
          }}
        >
          ×
        </button>
      </div>
    </li>
  );
}
