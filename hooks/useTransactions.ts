"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayStr } from "@/lib/dates";
import type { Txn } from "@/lib/types";

export interface NewTxn {
  kind: Txn["kind"];
  amount: number;
  currency: string;
  note: string;
  person?: string;
  category?: string;
  date?: string;
}

interface Row {
  id: string;
  created_at: string;
  kind: "expense" | "loan";
  amount: number | string;
  currency: string;
  note: string | null;
  person: string | null;
  category: string | null;
  date: string;
  settled: boolean | null;
}

function rowToTxn(r: Row): Txn {
  return {
    id: r.id,
    at: r.created_at ? Date.parse(r.created_at) : 0,
    kind: r.kind,
    amount: Number(r.amount),
    currency: r.currency,
    note: r.note ?? "",
    person: r.person ?? undefined,
    category: r.category ?? undefined,
    date: r.date,
    settled: !!r.settled,
  };
}

/**
 * Loads and mutates the signed-in user's transactions in Supabase.
 * Updates are optimistic so the UI feels instant, then persist to the DB.
 */
function sortTxns(list: Txn[]): Txn[] {
  return [...list].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at
  );
}

export function useTransactions(supabase: SupabaseClient) {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const txnsRef = useRef<Txn[]>([]);
  txnsRef.current = txns;

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("kind", "expense")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) console.warn("Could not load transactions:", error.message);
      else if (data) setTxns((data as Row[]).map(rowToTxn));
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const add = useCallback(
    async (t: NewTxn) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const insert = {
        user_id: user.id,
        kind: t.kind,
        amount: t.amount,
        currency: t.currency,
        note: t.note ?? "",
        person: t.person ?? null,
        category: t.category ?? null,
        date: t.date || todayStr(),
        settled: false,
      };

      const { data, error } = await supabase
        .from("transactions")
        .insert(insert)
        .select()
        .single();

      if (error) console.warn("Could not add transaction:", error.message);
      else if (data) setTxns((prev) => [rowToTxn(data as Row), ...prev]);
    },
    [supabase]
  );

  // Delete is split so the UI can offer Undo: hide locally now, then either
  // restore (undo) or commit the DB delete after the toast expires.
  const removeLocal = useCallback((id: string): Txn | undefined => {
    const found = txnsRef.current.find((t) => t.id === id);
    setTxns((prev) => prev.filter((t) => t.id !== id));
    return found;
  }, []);

  const restore = useCallback((txn: Txn) => {
    setTxns((prev) => sortTxns([...prev, txn]));
  }, []);

  const commitDelete = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) console.warn("Could not delete transaction:", error.message);
    },
    [supabase]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Txn>) => {
      setTxns((prev) =>
        sortTxns(prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      );
      const db: Record<string, unknown> = {};
      if (patch.amount !== undefined) db.amount = patch.amount;
      if (patch.currency !== undefined) db.currency = patch.currency;
      if (patch.note !== undefined) db.note = patch.note;
      if (patch.person !== undefined) db.person = patch.person ?? null;
      if (patch.category !== undefined) db.category = patch.category ?? null;
      if (patch.date !== undefined) db.date = patch.date;
      if (patch.settled !== undefined) db.settled = patch.settled;
      const { error } = await supabase.from("transactions").update(db).eq("id", id);
      if (error) console.warn("Could not update transaction:", error.message);
    },
    [supabase]
  );

  const toggleSettled = useCallback(
    async (id: string) => {
      let next: boolean | undefined;
      setTxns((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            next = !t.settled;
            return { ...t, settled: next };
          }
          return t;
        })
      );
      if (next !== undefined) {
        const { error } = await supabase
          .from("transactions")
          .update({ settled: next })
          .eq("id", id);
        if (error) console.warn("Could not update transaction:", error.message);
      }
    },
    [supabase]
  );

  return { txns, loaded, add, update, removeLocal, restore, commitDelete, toggleSettled };
}
