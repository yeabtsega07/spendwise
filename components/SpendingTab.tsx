"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/currency";
import { categoryColor, categoryIcon } from "@/lib/categories";
import Icon from "./Icon";
import { currentMonthKey, monthKey, monthLabel } from "@/lib/dates";
import { expensesOf, knownMonths, sortByDateDesc, sumByCurrency } from "@/lib/selectors";
import type { Txn } from "@/lib/types";
import TxnItem from "./TxnItem";
import EmptyState from "./EmptyState";
import SkeletonList from "./Skeleton";

interface Props {
  txns: Txn[];
  loaded: boolean;
  onDelete: (id: string) => void;
  onEdit: (t: Txn) => void;
}

export default function SpendingTab({ txns, loaded, onDelete, onEdit }: Props) {
  const [selected, setSelected] = useState<string>(currentMonthKey());

  // Always include the current month so the dropdown value is valid even
  // before any expense exists for it.
  const months = Array.from(new Set([currentMonthKey(), ...knownMonths(txns)]))
    .sort()
    .reverse();

  let list = expensesOf(txns);
  if (selected !== "all") list = list.filter((t) => monthKey(t.date) === selected);

  const totals = sumByCurrency(list);

  // Category breakdown, grouped by currency (currencies stay separate).
  const byCur: Record<string, Record<string, number>> = {};
  for (const t of list) {
    const cat = t.category || "Other";
    byCur[t.currency] = byCur[t.currency] || {};
    byCur[t.currency][cat] = (byCur[t.currency][cat] || 0) + t.amount;
  }

  const sorted = sortByDateDesc(list);

  return (
    <>
      <div className="card">
        <div className="row-between">
          <h2>Spending</h2>
          <select
            className="month-filter"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="totals-block">
          {Object.keys(totals).length ? (
            Object.entries(totals).map(([cur, amt]) => (
              <div className="total-pill" key={cur}>
                <div className="total-amt">{formatMoney(amt, cur)}</div>
                <div className="total-cur">{cur} spent</div>
              </div>
            ))
          ) : (
            <div className="empty">No expenses in this period.</div>
          )}
        </div>

        <div className="category-block">
          {Object.entries(byCur).map(([cur, cats]) => {
            const rows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
            const max = Math.max(...rows.map((r) => r[1]));
            return (
              <div key={cur}>
                <div className="total-cur" style={{ margin: "14px 0 6px" }}>
                  By category · {cur}
                </div>
                {rows.map(([cat, amt]) => (
                  <div className="cat-row" key={cat}>
                    <div className="cat-row-head">
                      <span className="cat-label">
                        <span
                          className="cat-dot"
                          style={{ background: `${categoryColor(cat)}1f`, color: categoryColor(cat) }}
                        >
                          <Icon name={categoryIcon(cat)} size={15} />
                        </span>
                        {cat}
                      </span>
                      <span>{formatMoney(amt, cur)}</span>
                    </div>
                    <div className="cat-bar">
                      <span
                        style={{
                          width: `${Math.round((amt / max) * 100)}%`,
                          background: `linear-gradient(90deg, ${categoryColor(cat)}cc, ${categoryColor(cat)})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Expenses</h2>
        {!loaded ? (
          <SkeletonList rows={5} />
        ) : sorted.length ? (
          <ul className="txn-list">
            {sorted.map((t) => (
              <TxnItem key={t.id} txn={t} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="receipt" title="No expenses here" sub="Try a different month, or add one from the Add tab." />
        )}
      </div>
    </>
  );
}
