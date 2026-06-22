"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayStr } from "@/lib/dates";
import type { Loan } from "@/lib/types";

export interface NewLoan {
  borrowerId?: string;
  borrowerName: string;
  amount: number;
  currency: string;
  note: string;
  date?: string;
}

interface LoanRow {
  id: string;
  created_at: string;
  lender_id: string;
  lender_name: string | null;
  borrower_id: string | null;
  borrower_name: string | null;
  amount: number | string;
  currency: string;
  note: string | null;
  date: string;
  status: "active" | "settled";
}

function rowToLoan(r: LoanRow, uid: string): Loan {
  const direction: "out" | "in" = r.lender_id === uid ? "out" : "in";
  const counterpart =
    direction === "out"
      ? r.borrower_name || "Someone"
      : r.lender_name || "Someone";
  // From the lender's view, a loan is "linked" when a real borrower is attached.
  const linked = direction === "out" ? !!r.borrower_id : true;
  return {
    id: r.id,
    at: r.created_at ? Date.parse(r.created_at) : 0,
    lenderId: r.lender_id,
    lenderName: r.lender_name || "",
    borrowerId: r.borrower_id ?? undefined,
    borrowerName: r.borrower_name || "",
    amount: Number(r.amount),
    currency: r.currency,
    note: r.note ?? "",
    date: r.date,
    status: r.status,
    direction,
    counterpart,
    linked,
  };
}

function sortLoans(list: Loan[]): Loan[] {
  return [...list].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at
  );
}

/**
 * Loads loans where the signed-in user is the lender OR the borrower, so a loan
 * someone records against you shows up here automatically. Mutations are
 * optimistic, then persisted.
 */
export function useLoans(supabase: SupabaseClient, uid: string, myName: string) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<Loan[]>([]);
  ref.current = loans;

  const reload = useCallback(async () => {
    if (!uid) return;
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) console.warn("Could not load loans:", error.message);
    else if (data) setLoans((data as LoanRow[]).map((r) => rowToLoan(r, uid)));
    setLoaded(true);
  }, [supabase, uid]);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(
    async (n: NewLoan) => {
      if (!uid) return;
      const insert = {
        lender_id: uid,
        lender_name: myName,
        borrower_id: n.borrowerId ?? null,
        borrower_name: n.borrowerName,
        amount: n.amount,
        currency: n.currency,
        note: n.note ?? "",
        date: n.date || todayStr(),
        status: "active" as const,
      };
      const { data, error } = await supabase
        .from("loans")
        .insert(insert)
        .select()
        .single();
      if (error) console.warn("Could not add loan:", error.message);
      else if (data)
        setLoans((prev) => sortLoans([rowToLoan(data as LoanRow, uid), ...prev]));
    },
    [supabase, uid, myName]
  );

  const setStatus = useCallback(
    async (id: string, status: "active" | "settled") => {
      setLoans((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status } : l))
      );
      const { error } = await supabase
        .from("loans")
        .update({ status })
        .eq("id", id);
      if (error) console.warn("Could not update loan:", error.message);
    },
    [supabase]
  );

  const toggleSettled = useCallback(
    (id: string) => {
      const cur = ref.current.find((l) => l.id === id);
      if (!cur) return;
      setStatus(id, cur.status === "settled" ? "active" : "settled");
    },
    [setStatus]
  );

  const remove = useCallback(
    async (id: string) => {
      setLoans((prev) => prev.filter((l) => l.id !== id));
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) console.warn("Could not delete loan:", error.message);
    },
    [supabase]
  );

  return { loans, loaded, add, toggleSettled, remove, reload };
}
