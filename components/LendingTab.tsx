"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { todayStr, shortDate } from "@/lib/dates";
import type { Loan } from "@/lib/types";
import type { NewLoan } from "@/hooks/useLoans";
import PersonSearch, { type Picked } from "./PersonSearch";
import Avatar from "./Avatar";
import EmptyState from "./EmptyState";
import SkeletonList from "./Skeleton";
import { useToast } from "./Toast";

interface Props {
  supabase: SupabaseClient;
  uid: string;
  loans: Loan[];
  loaded: boolean;
  add: (n: NewLoan) => void;
  toggleSettled: (id: string) => void;
  remove: (id: string) => void;
}

function sumByCur(list: Loan[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of list) out[l.currency] = (out[l.currency] || 0) + l.amount;
  return out;
}

function moneyLine(map: Record<string, number>): string {
  const entries = Object.entries(map).filter(([, a]) => a > 0.000001);
  if (!entries.length) return "—";
  return entries.map(([c, a]) => formatMoney(a, c)).join(" · ");
}

function LoanItem({
  loan,
  uid,
  onToggle,
  onRemove,
}: {
  loan: Loan;
  uid: string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const settled = loan.status === "settled";
  const canDelete = loan.lenderId === uid;
  const meta: string[] = [];
  if (loan.note) meta.push(loan.note);
  meta.push(shortDate(loan.date));
  if (settled) meta.push("settled ✓");

  return (
    <div className={`loan-item ${settled ? "is-settled" : ""}`}>
      <Avatar name={loan.counterpart} size={42} linked={loan.linked} />
      <div className="loan-body">
        <div className="loan-name">{loan.counterpart}</div>
        <div className="loan-meta">{meta.join(" · ")}</div>
      </div>
      <div className="loan-right">
        <span className={`loan-amount ${loan.direction === "out" ? "pos" : "neg"}`}>
          {loan.direction === "out" ? "+" : "−"}
          {formatMoney(loan.amount, loan.currency)}
        </span>
        <div className="loan-actions">
          <button
            className={`settle-btn ${settled ? "settled" : ""}`}
            onClick={() => onToggle(loan.id)}
          >
            {settled ? "Undo" : "Settle"}
          </button>
          {canDelete && (
            <button
              className="loan-del"
              aria-label="Delete"
              onClick={() => onRemove(loan.id)}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LendingTab({
  supabase,
  uid,
  loans,
  loaded,
  add,
  toggleSettled,
  remove,
}: Props) {
  const [person, setPerson] = useState<Picked | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ETB");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<"out" | "in">("out");
  const toast = useToast();

  function submit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !person) return;
    add({
      borrowerId: person.id,
      borrowerName: person.name,
      amount: amt,
      currency,
      note: note.trim(),
      date: date || todayStr(),
    });
    toast.show(
      person.id
        ? `Loan to ${person.name} sent — it's on their screen now 🤝`
        : `Loan to ${person.name} recorded 🤝`
    );
    setPerson(null);
    setAmount("");
    setNote("");
    setDate(todayStr());
  }

  const active = loans.filter((l) => l.status === "active");
  const owedToYou = active.filter((l) => l.direction === "out");
  const youOwe = active.filter((l) => l.direction === "in");

  const shown = (view === "out" ? owedToYou : youOwe).slice();
  // Keep settled ones visible at the bottom of the matching direction.
  const settledInView = loans.filter(
    (l) => l.status === "settled" && l.direction === view
  );

  return (
    <>
      <div className="card">
        <h2>Lend money</h2>
        <p className="hint">
          Search someone by email — if they&apos;re on SpendWise, the loan shows up on
          their screen too. Otherwise it&apos;s tracked just by name.
        </p>
        <form className="lend-form" onSubmit={submit} autoComplete="off">
          <label className="field">
            Who are you lending to?
            <PersonSearch
              supabase={supabase}
              excludeId={uid}
              value={person}
              onChange={setPerson}
              placeholder="name or email…"
            />
          </label>
          <div className="field-grid">
            <label className="field">
              Amount
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="field">
              Currency
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {Object.entries(CURRENCIES).map(([code, info]) => (
                  <option key={code} value={code}>
                    {code} — {info.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Note (optional)
            <input
              type="text"
              placeholder="e.g. for taxi"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="submit" className="btn primary full" disabled={!person || !amount}>
            Record loan
          </button>
        </form>
      </div>

      <div className="card">
        <div className="balance-tiles">
          <div className="balance-tile pos">
            <span className="balance-label">You&apos;re owed</span>
            <span className="balance-amt">{moneyLine(sumByCur(owedToYou))}</span>
          </div>
          <div className="balance-tile neg">
            <span className="balance-label">You owe</span>
            <span className="balance-amt">{moneyLine(sumByCur(youOwe))}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="seg-solid" role="tablist">
          <button className={view === "out" ? "on" : ""} onClick={() => setView("out")}>
            You&apos;re owed
          </button>
          <button className={view === "in" ? "on" : ""} onClick={() => setView("in")}>
            You owe
          </button>
        </div>

        {!loaded ? (
          <SkeletonList rows={3} />
        ) : shown.length || settledInView.length ? (
          <div className="loan-list">
            {shown.map((l) => (
              <LoanItem
                key={l.id}
                loan={l}
                uid={uid}
                onToggle={toggleSettled}
                onRemove={remove}
              />
            ))}
            {settledInView.map((l) => (
              <LoanItem
                key={l.id}
                loan={l}
                uid={uid}
                onToggle={toggleSettled}
                onRemove={remove}
              />
            ))}
          </div>
        ) : view === "out" ? (
          <EmptyState icon="coins" title="Nobody owes you" sub="Record a loan above to track it." />
        ) : (
          <EmptyState icon="checkCircle" title="You're all square" sub="You don't owe anyone right now." />
        )}
      </div>
    </>
  );
}
