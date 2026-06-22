"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayStr } from "@/lib/dates";
import type { Bill, BillShare } from "@/lib/types";

export interface NewShare {
  userId?: string;
  name: string;
  amount: number;
  isCreator?: boolean;
}

export interface NewBill {
  title: string;
  currency: string;
  total: number;
  date?: string;
  shares: NewShare[];
}

interface BillRow {
  id: string;
  created_at: string;
  creator_id: string;
  title: string | null;
  currency: string;
  total: number | string;
  date: string;
}

interface ShareRow {
  id: string;
  bill_id: string;
  user_id: string | null;
  name: string | null;
  amount: number | string;
  paid: boolean;
  is_creator: boolean;
}

function shareRowTo(r: ShareRow): BillShare {
  return {
    id: r.id,
    userId: r.user_id ?? undefined,
    name: r.name || "",
    amount: Number(r.amount),
    paid: r.paid,
    isCreator: r.is_creator,
  };
}

function billRowTo(r: BillRow, shares: BillShare[]): Bill {
  return {
    id: r.id,
    at: r.created_at ? Date.parse(r.created_at) : 0,
    creatorId: r.creator_id,
    title: r.title || "",
    currency: r.currency,
    total: Number(r.total),
    date: r.date,
    shares,
  };
}

function sortBills(list: Bill[]): Bill[] {
  return [...list].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at
  );
}

/**
 * Loads split bills the user is part of (as creator or participant), with all
 * their shares. A bill someone splits with you appears here automatically.
 */
export function useBills(supabase: SupabaseClient, uid: string) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: billRows, error } = await supabase
      .from("bills")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("Could not load bills:", error.message);
      setLoaded(true);
      return;
    }
    const rows = (billRows as BillRow[]) || [];
    let shareRows: ShareRow[] = [];
    if (rows.length) {
      const { data: sd, error: se } = await supabase
        .from("bill_shares")
        .select("*")
        .in(
          "bill_id",
          rows.map((b) => b.id)
        );
      if (se) console.warn("Could not load bill shares:", se.message);
      else shareRows = (sd as ShareRow[]) || [];
    }
    const byBill: Record<string, BillShare[]> = {};
    for (const s of shareRows) {
      (byBill[s.bill_id] = byBill[s.bill_id] || []).push(shareRowTo(s));
    }
    setBills(rows.map((b) => billRowTo(b, byBill[b.id] || [])));
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    if (!uid) return;
    load();
  }, [uid, load]);

  const create = useCallback(
    async (b: NewBill) => {
      if (!uid) return;
      const { data: billData, error } = await supabase
        .from("bills")
        .insert({
          creator_id: uid,
          title: b.title,
          currency: b.currency,
          total: b.total,
          date: b.date || todayStr(),
        })
        .select()
        .single();
      if (error || !billData) {
        console.warn("Could not create bill:", error?.message);
        return;
      }
      const billId = (billData as BillRow).id;
      const shareInserts = b.shares.map((s) => ({
        bill_id: billId,
        user_id: s.userId ?? null,
        name: s.name,
        amount: s.amount,
        paid: !!s.isCreator, // the creator already paid (they covered the bill)
        is_creator: !!s.isCreator,
      }));
      const { error: se } = await supabase.from("bill_shares").insert(shareInserts);
      if (se) console.warn("Could not create bill shares:", se.message);
      await load();
    },
    [supabase, uid, load]
  );

  const setPaid = useCallback(
    async (billId: string, shareId: string, paid: boolean) => {
      setBills((prev) =>
        prev.map((bill) =>
          bill.id === billId
            ? {
                ...bill,
                shares: bill.shares.map((s) =>
                  s.id === shareId ? { ...s, paid } : s
                ),
              }
            : bill
        )
      );
      const { error } = await supabase
        .from("bill_shares")
        .update({ paid })
        .eq("id", shareId);
      if (error) console.warn("Could not update share:", error.message);
    },
    [supabase]
  );

  const remove = useCallback(
    async (billId: string) => {
      setBills((prev) => prev.filter((b) => b.id !== billId));
      const { error } = await supabase.from("bills").delete().eq("id", billId);
      if (error) console.warn("Could not delete bill:", error.message);
    },
    [supabase]
  );

  return { bills: sortBills(bills), loaded, create, setPaid, remove, reload: load };
}
