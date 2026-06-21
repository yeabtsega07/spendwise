"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { todayStr, shortDate } from "@/lib/dates";
import type { Bill } from "@/lib/types";
import type { NewBill, NewShare } from "@/hooks/useBills";
import PersonSearch, { type Picked } from "./PersonSearch";
import Avatar from "./Avatar";
import Icon from "./Icon";
import EmptyState from "./EmptyState";
import SkeletonList from "./Skeleton";
import { useToast } from "./Toast";

interface Props {
  supabase: SupabaseClient;
  uid: string;
  myName: string;
  bills: Bill[];
  loaded: boolean;
  create: (b: NewBill) => void;
  setPaid: (billId: string, shareId: string, paid: boolean) => void;
  remove: (billId: string) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function BillCard({
  bill,
  uid,
  onSetPaid,
  onRemove,
}: {
  bill: Bill;
  uid: string;
  onSetPaid: (billId: string, shareId: string, paid: boolean) => void;
  onRemove: (billId: string) => void;
}) {
  const isCreator = bill.creatorId === uid;
  const myShare = bill.shares.find((s) => s.userId === uid && !s.isCreator);
  const others = bill.shares.filter((s) => !s.isCreator);
  const owedToCreator = others
    .filter((s) => !s.paid)
    .reduce((sum, s) => sum + s.amount, 0);
  const settledCount = others.filter((s) => s.paid).length;

  let statusLine: string;
  if (isCreator) {
    statusLine =
      owedToCreator > 0.0001
        ? `You're owed ${formatMoney(owedToCreator, bill.currency)}`
        : "Everyone settled up 🎉";
  } else if (myShare) {
    statusLine = myShare.paid
      ? "You've settled your share ✓"
      : `You owe ${formatMoney(myShare.amount, bill.currency)}`;
  } else {
    statusLine = "";
  }

  return (
    <div className="bill-card">
      <div className="bill-head">
        <div className="bill-emoji">
          <Icon name="receipt" size={20} />
        </div>
        <div className="bill-head-body">
          <div className="bill-title">{bill.title || "Split bill"}</div>
          <div className="bill-sub">
            {formatMoney(bill.total, bill.currency)} · {shortDate(bill.date)} ·{" "}
            {others.length + 1} people
          </div>
        </div>
        {isCreator && (
          <button
            className="loan-del"
            aria-label="Delete bill"
            onClick={() => onRemove(bill.id)}
          >
            ×
          </button>
        )}
      </div>

      <div className={`bill-status ${owedToCreator > 0.0001 || (myShare && !myShare.paid) ? "" : "done"}`}>
        {statusLine}
      </div>

      <div className="bill-shares">
        {bill.shares.map((s) => {
          const mine = s.userId === uid;
          const canToggle = !s.isCreator && (isCreator || mine);
          return (
            <div className={`share-row ${s.paid ? "paid" : ""}`} key={s.id}>
              <Avatar name={s.name || "?"} size={30} linked={!!s.userId} />
              <span className="share-name">
                {s.name}
                {mine && <span className="you-tag">you</span>}
                {s.isCreator && <span className="paid-tag">paid the bill</span>}
              </span>
              <span className="share-amt">{formatMoney(s.amount, bill.currency)}</span>
              {!s.isCreator &&
                (canToggle ? (
                  <button
                    className={`mini-btn ${s.paid ? "done" : ""}`}
                    onClick={() => onSetPaid(bill.id, s.id, !s.paid)}
                  >
                    {s.paid ? "Paid ✓" : "Mark paid"}
                  </button>
                ) : (
                  <span className={`share-state ${s.paid ? "done" : ""}`}>
                    {s.paid ? "paid" : "owes"}
                  </span>
                ))}
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <div className="bill-progress">
          <div className="bill-progress-bar">
            <span style={{ width: `${(settledCount / others.length) * 100}%` }} />
          </div>
          <span className="bill-progress-text">
            {settledCount}/{others.length} settled
          </span>
        </div>
      )}
    </div>
  );
}

export default function SplitTab({
  supabase,
  uid,
  myName,
  bills,
  loaded,
  create,
  setPaid,
  remove,
}: Props) {
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState("ETB");
  const [date, setDate] = useState(todayStr());
  const [participants, setParticipants] = useState<Picked[]>([]);
  const [adding, setAdding] = useState<Picked | null>(null);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const toast = useToast();

  const totalNum = parseFloat(total) || 0;
  const headcount = participants.length + 1; // + you

  // Everyone in the split, you first.
  const people = useMemo(
    () => [
      { key: "__me__", name: myName, id: uid as string | undefined, isCreator: true },
      ...participants.map((p, i) => ({
        key: p.id || `n${i}`,
        name: p.name,
        id: p.id,
        isCreator: false,
      })),
    ],
    [participants, myName, uid]
  );

  // Computed share per person.
  const shareOf = (key: string, isCreator: boolean): number => {
    if (mode === "custom") return round2(parseFloat(custom[key] || "0") || 0);
    if (!headcount) return 0;
    const base = round2(totalNum / headcount);
    // Give the rounding remainder to the creator so shares sum to the total.
    if (isCreator) return round2(totalNum - base * (headcount - 1));
    return base;
  };

  const customSum = people.reduce((s, p) => s + shareOf(p.key, p.isCreator), 0);
  const customOff = mode === "custom" && Math.abs(customSum - totalNum) > 0.01;

  function addParticipant(p: Picked | null) {
    if (!p) {
      setAdding(null);
      return;
    }
    // Avoid duplicates (by id when linked, else by name).
    const dup = participants.some((q) =>
      p.id ? q.id === p.id : q.name.toLowerCase() === p.name.toLowerCase()
    );
    if (!dup) setParticipants((prev) => [...prev, p]);
    setAdding(null);
  }

  function removeParticipant(i: number) {
    setParticipants((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!totalNum || totalNum <= 0 || !participants.length) return;
    if (customOff) return;
    const shares: NewShare[] = people.map((p) => ({
      userId: p.id,
      name: p.name,
      amount: shareOf(p.key, p.isCreator),
      isCreator: p.isCreator,
    }));
    create({
      title: title.trim() || "Split bill",
      currency,
      total: totalNum,
      date: date || todayStr(),
      shares,
    });
    const linked = participants.filter((p) => p.id).length;
    toast.show(
      linked
        ? `Bill split — ${linked} ${linked === 1 ? "person sees" : "people see"} it on their screen 🧾`
        : "Bill split 🧾"
    );
    setTitle("");
    setTotal("");
    setParticipants([]);
    setCustom({});
    setMode("equal");
    setDate(todayStr());
  }

  return (
    <>
      <div className="card">
        <h2>Split a bill</h2>
        <p className="hint">
          Add who shared it — search by email to send each person their share. Split
          it equally or set custom amounts.
        </p>
        <form className="lend-form" onSubmit={submit} autoComplete="off">
          <label className="field">
            What was it for?
            <input
              type="text"
              placeholder="e.g. dinner at Yod Abyssinia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              Total
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                required
                value={total}
                onChange={(e) => setTotal(e.target.value)}
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
            Add people
            <PersonSearch
              supabase={supabase}
              excludeId={uid}
              value={adding}
              onChange={addParticipant}
              placeholder="name or email…"
            />
          </label>

          <div className="split-people">
            <div className="split-person you">
              <Avatar name={myName} size={32} />
              <span className="split-person-name">
                {myName} <span className="you-tag">you · paid</span>
              </span>
              {totalNum > 0 && mode === "equal" && (
                <span className="split-person-amt">
                  {formatMoney(shareOf("__me__", true), currency)}
                </span>
              )}
              {mode === "custom" && (
                <input
                  className="split-amt-input"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  value={custom["__me__"] || ""}
                  onChange={(e) => setCustom({ ...custom, __me__: e.target.value })}
                />
              )}
            </div>

            {participants.map((p, i) => {
              const key = p.id || `n${i}`;
              return (
                <div className="split-person" key={key}>
                  <Avatar name={p.name} size={32} linked={!!p.id} />
                  <span className="split-person-name">
                    {p.name}
                    {!p.id && <span className="off-tag">off SpendWise</span>}
                  </span>
                  {totalNum > 0 && mode === "equal" && (
                    <span className="split-person-amt">
                      {formatMoney(shareOf(key, false), currency)}
                    </span>
                  )}
                  {mode === "custom" && (
                    <input
                      className="split-amt-input"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0"
                      value={custom[key] || ""}
                      onChange={(e) => setCustom({ ...custom, [key]: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    className="person-chip-x"
                    aria-label="Remove"
                    onClick={() => removeParticipant(i)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {participants.length > 0 && (
            <>
              <div className="seg-solid small" role="tablist">
                <button
                  type="button"
                  className={mode === "equal" ? "on" : ""}
                  onClick={() => setMode("equal")}
                >
                  Split equally
                </button>
                <button
                  type="button"
                  className={mode === "custom" ? "on" : ""}
                  onClick={() => setMode("custom")}
                >
                  Custom
                </button>
              </div>
              {customOff && (
                <p className="split-warn">
                  Shares add up to {formatMoney(customSum, currency)} — needs to equal{" "}
                  {formatMoney(totalNum, currency)}.
                </p>
              )}
            </>
          )}

          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <button
            type="submit"
            className="btn primary full"
            disabled={!totalNum || !participants.length || customOff}
          >
            Split {headcount} ways
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Bills</h2>
        {!loaded ? (
          <SkeletonList rows={3} />
        ) : bills.length ? (
          <div className="bill-list">
            {bills.map((b) => (
              <BillCard
                key={b.id}
                bill={b}
                uid={uid}
                onSetPaid={setPaid}
                onRemove={remove}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="users"
            title="No split bills yet"
            sub="Split your first shared expense above."
          />
        )}
      </div>
    </>
  );
}
