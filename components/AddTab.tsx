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
import Icon from "./Icon";
import { useToast } from "./Toast";

const PAGE_SIZE = 6;

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
  const [page, setPage] = useState(1);
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
    setPage(1);
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
    setPage(1);
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

  const sorted = sortByDateDesc(txns);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const recent = sorted.slice(start, start + PAGE_SIZE);
  const showPager = sorted.length > PAGE_SIZE;

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
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Recent</h2>
          {loaded && sorted.length > 0 && (
            <span className="count-badge">{sorted.length}</span>
          )}
        </div>
        {!loaded ? (
          <SkeletonList rows={4} />
        ) : recent.length ? (
          <>
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
            {showPager && (
              <div className="pager">
                <button
                  className="pager-btn"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                >
                  <Icon name="chevronLeft" size={18} />
                </button>
                <span className="pager-info">
                  {start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)}
                  <span className="pager-of"> of {sorted.length}</span>
                </span>
                <button
                  className="pager-btn"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                  aria-label="Next page"
                >
                  <Icon name="chevronRight" size={18} />
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon="wallet" title="Nothing yet" sub="Add your first expense above to get started." />
        )}
      </div>
    </>
  );
}
