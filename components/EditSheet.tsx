"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CURRENCIES } from "@/lib/currency";
import { CATEGORIES } from "@/lib/categories";
import type { Txn } from "@/lib/types";

interface Props {
  txn: Txn;
  onSave: (patch: Partial<Txn>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function EditSheet({ txn, onSave, onDelete, onClose }: Props) {
  const isLoan = txn.kind === "loan";
  const [amount, setAmount] = useState(String(txn.amount));
  const [currency, setCurrency] = useState(txn.currency);
  const [note, setNote] = useState(txn.note);
  const [person, setPerson] = useState(txn.person || "");
  const [category, setCategory] = useState(txn.category || "Other");
  const [date, setDate] = useState(txn.date);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (isLoan && !person.trim()) return;
    if (!isLoan && !note.trim()) return;
    onSave({
      amount: amt,
      currency,
      note: note.trim(),
      date,
      ...(isLoan ? { person: person.trim() } : { category }),
    });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>Edit {isLoan ? "loan" : "expense"}</h2>
        <form className="detail-form" onSubmit={save} autoComplete="off">
          <label>
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
          <label>
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.entries(CURRENCIES).map(([code, info]) => (
                <option key={code} value={code}>
                  {code} — {info.name}
                </option>
              ))}
            </select>
          </label>

          {isLoan ? (
            <>
              <label className="full">
                Who
                <input
                  type="text"
                  required
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                />
              </label>
              <label className="full">
                Note (optional)
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="full">
                What for?
                <input
                  type="text"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.key}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <button type="submit" className="btn primary full">
            Save changes
          </button>
        </form>

        <div className="sheet-actions">
          <button type="button" className="btn sheet-del" onClick={onDelete}>
            Delete
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
