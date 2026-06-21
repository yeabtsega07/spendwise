"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/currency";
import { currentMonthKey, monthKey, monthLabel } from "@/lib/dates";
import { expensesOf, sumByCurrency } from "@/lib/selectors";
import type { Txn } from "@/lib/types";
import Icon from "./Icon";

interface Props {
  txns: Txn[];
  owed: Record<string, number>;
  owing: Record<string, number>;
  range: "month" | "all";
  onToggleRange: () => void;
}

/** Smoothly counts the displayed amount up/down when it changes. */
function CountUp({ value, currency }: { value: number; currency: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = to;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(to);
      return;
    }
    const duration = 600;
    let start: number | undefined;
    let raf = 0;
    const tick = (t: number) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{formatMoney(display, currency)}</>;
}

export default function Summary({ txns, owed, owing, range, onToggleRange }: Props) {
  const isMonth = range === "month";

  let exp = expensesOf(txns);
  if (isMonth) exp = exp.filter((t) => monthKey(t.date) === currentMonthKey());
  const totals = sumByCurrency(exp);

  // 2-state segmented control: clicking the inactive option flips the range.
  const setMonth = () => {
    if (!isMonth) onToggleRange();
  };
  const setAll = () => {
    if (isMonth) onToggleRange();
  };

  return (
    <section className="summary">
      <div className="summary-head">
        <span>{isMonth ? monthLabel(currentMonthKey()) : "All time"}</span>
        <div className="seg" role="tablist">
          <button className={isMonth ? "on" : ""} onClick={setMonth}>
            This month
          </button>
          <button className={!isMonth ? "on" : ""} onClick={setAll}>
            All time
          </button>
        </div>
      </div>

      <div className="summary-totals">
        {Object.keys(totals).length === 0 ? (
          <div className="summary-empty">No spending logged yet — add your first below 👇</div>
        ) : (
          Object.entries(totals).map(([cur, amt]) => (
            <div className="summary-amount" key={cur}>
              <CountUp value={amt} currency={cur} />
              <small>spent · {cur}</small>
            </div>
          ))
        )}
      </div>

      {(Object.keys(owed).length > 0 || Object.keys(owing).length > 0) && (
        <div className="summary-chips">
          {Object.keys(owed).length > 0 && (
            <div className="summary-owed">
              <Icon name="owed" size={15} strokeWidth={2.4} />
              Owed to you{" "}
              <b>
                {Object.entries(owed)
                  .map(([c, a]) => formatMoney(a, c))
                  .join(" · ")}
              </b>
            </div>
          )}
          {Object.keys(owing).length > 0 && (
            <div className="summary-owed owe">
              <Icon name="owe" size={15} strokeWidth={2.4} />
              You owe{" "}
              <b>
                {Object.entries(owing)
                  .map(([c, a]) => formatMoney(a, c))
                  .join(" · ")}
              </b>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
