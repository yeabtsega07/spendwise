"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { parseEntry } from "@/lib/parse";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { CATEGORIES } from "@/lib/categories";
import { todayStr } from "@/lib/dates";
import { sortByDateDesc } from "@/lib/selectors";
import type { NewTxn } from "@/hooks/useTransactions";
import type { NewLoan } from "@/hooks/useLoans";
import type { Txn } from "@/lib/types";
import TxnItem from "./TxnItem";
import EmptyState from "./EmptyState";
import SkeletonList from "./Skeleton";
import { useToast } from "./Toast";

interface Props {
  txns: Txn[];
  loaded: boolean;
  add: (t: NewTxn) => void;
  addLoan: (n: NewLoan) => void;
  onDelete: (id: string) => void;
  onEdit: (t: Txn) => void;
  onToggleSettle: (id: string) => void;
}

const emptyDetail = () => ({
  amount: "",
  currency: "ETB",
  note: "",
  category: "Other",
  date: todayStr(),
});

export default function AddTab({ txns, loaded, add, addLoan, onDelete, onEdit, onToggleSettle }: Props) {
  const [quick, setQuick] = useState("");
  const [detail, setDetail] = useState(emptyDetail);
  const toast = useToast();

  const parsed = parseEntry(quick);

  function submitQuick(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    if (parsed.kind === "loan") {
      addLoan({
        borrowerName: parsed.person || "Someone",
        amount: parsed.amount,
        currency: parsed.currency,
        note: parsed.note,
      });
      setQuick("");
      toast.show("Loan recorded — open Lending to link them by email 🤝");
      return;
    }
    add(parsed);
    setQuick("");
    toast.show("Added 🎉");
  }

  function submitDetail(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(detail.amount);
    if (!amt || amt <= 0 || !detail.note.trim()) return;
    add({
      kind: "expense",
      amount: amt,
      currency: detail.currency,
      note: detail.note.trim(),
      category: detail.category,
      date: detail.date || todayStr(),
    });
    setDetail(emptyDetail());
    toast.show("Added 🎉");
  }

  let preview: ReactNode = "";
  let previewOk = false;
  if (parsed) {
    previewOk = true;
    preview =
      parsed.kind === "loan"
        ? `🤝 Lend ${formatMoney(parsed.amount, parsed.currency)} to ${parsed.person || "?"}`
        : `${formatMoney(parsed.amount, parsed.currency)} · ${parsed.note} · ${parsed.category}`;
  } else if (quick.trim()) {
    preview = "Keep typing… e.g. 10 birr gum";
  }

  const recent = sortByDateDesc(txns).slice(0, 8);

  return (
    <>
      <div className="card">
        <h2>Quick add</h2>
        <p className="hint">
          Type it like you&apos;d say it — <em>10 birr gum</em>, <em>200 birr ride</em>,{" "}
          <em>108 usd claude subscription</em>
        </p>
        <form onSubmit={submitQuick} autoComplete="off">
          <div className="quick-row">
            <input
              type="text"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="10 birr gum"
              aria-label="Quick add expense"
              enterKeyHint="done"
            />
            <button type="submit" className="btn primary">
              Add
            </button>
          </div>
          <p className={`parse-preview ${previewOk ? "ok" : ""}`}>{preview}</p>
        </form>
      </div>

      <div className="card">
        <details>
          <summary className="details-summary">Add with full details</summary>
          <form className="detail-form" onSubmit={submitDetail} autoComplete="off">
            <label>
              Amount
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                required
                value={detail.amount}
                onChange={(e) => setDetail({ ...detail, amount: e.target.value })}
              />
            </label>
            <label>
              Currency
              <select
                value={detail.currency}
                onChange={(e) => setDetail({ ...detail, currency: e.target.value })}
              >
                {Object.entries(CURRENCIES).map(([code, info]) => (
                  <option key={code} value={code}>
                    {code} — {info.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              What for?
              <input
                type="text"
                placeholder="e.g. lunch with friends"
                required
                value={detail.note}
                onChange={(e) => setDetail({ ...detail, note: e.target.value })}
              />
            </label>
            <label>
              Category
              <select
                value={detail.category}
                onChange={(e) => setDetail({ ...detail, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={detail.date}
                onChange={(e) => setDetail({ ...detail, date: e.target.value })}
              />
            </label>
            <button type="submit" className="btn primary full">
              Add expense
            </button>
          </form>
        </details>
      </div>

      <div className="card">
        <h2>Recent</h2>
        {!loaded ? (
          <SkeletonList rows={4} />
        ) : recent.length ? (
          <ul className="txn-list">
            {recent.map((t) => (
              <TxnItem
                key={t.id}
                txn={t}
                onDelete={onDelete}
                onEdit={onEdit}
                showSettle={t.kind === "loan"}
                onToggleSettle={onToggleSettle}
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon="wallet" title="Nothing yet" sub="Add your first expense above to get started." />
        )}
      </div>
    </>
  );
}
