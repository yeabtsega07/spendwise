"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTransactions } from "@/hooks/useTransactions";
import { useLoans } from "@/hooks/useLoans";
import { useBills } from "@/hooks/useBills";
import { ensureProfile, nameFromUser } from "@/lib/directory";
import { useToast } from "./Toast";
import Summary from "./Summary";
import Avatar from "./Avatar";
import AddTab from "./AddTab";
import SpendingTab from "./SpendingTab";
import LendingTab from "./LendingTab";
import SplitTab from "./SplitTab";
import ExportTab from "./ExportTab";
import EditSheet from "./EditSheet";
import ThemeToggle from "./ThemeToggle";
import NotificationBell, { type Notif, type NotifTab } from "./NotificationBell";
import TabBar, { type TabKey } from "./TabBar";
import { formatMoney } from "@/lib/currency";
import type { Txn } from "@/lib/types";

interface Props {
  supabase: SupabaseClient;
  email: string;
  userId: string;
  userMeta: Record<string, unknown> | null;
}

function addInto(map: Record<string, number>, cur: string, amt: number) {
  map[cur] = (map[cur] || 0) + amt;
}

export default function TrackerApp({ supabase, email, userId, userMeta }: Props) {
  const myName = useMemo(
    () => nameFromUser({ email, user_metadata: userMeta }),
    [email, userMeta]
  );

  const { txns, loaded, add, update, removeLocal, restore, commitDelete, toggleSettled } =
    useTransactions(supabase);
  const loans = useLoans(supabase, userId, myName);
  const billsApi = useBills(supabase, userId);
  const toast = useToast();
  const [active, setActive] = useState<TabKey>("add");
  const [range, setRange] = useState<"month" | "all">("month");
  const [editing, setEditing] = useState<Txn | null>(null);
  const [seen, setSeen] = useState(0);

  // Make sure others can find this user by email.
  useEffect(() => {
    ensureProfile(supabase);
  }, [supabase]);

  // Load the "last seen notifications" marker for this user.
  useEffect(() => {
    try {
      const v = localStorage.getItem(`sw-notif-seen-${userId}`);
      setSeen(v ? Number(v) : 0);
    } catch {}
  }, [userId]);

  // Re-fetch loans + bills when the tab regains focus, so a loan or split
  // someone just sent you shows up (and pings the bell) without a manual reload.
  const reloadLoans = loans.reload;
  const reloadBills = billsApi.reload;
  useEffect(() => {
    function onFocus() {
      if (document.visibilityState !== "hidden") {
        reloadLoans();
        reloadBills();
      }
    }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [reloadLoans, reloadBills]);

  // Incoming requests for the bell: loans where you're the borrower, and split
  // bills others created that include you. Newest first.
  const notifications = useMemo<Notif[]>(() => {
    const out: Notif[] = [];
    for (const l of loans.loans) {
      if (l.direction !== "in") continue;
      out.push({
        id: `loan:${l.id}`,
        at: l.at,
        icon: "coins",
        title: `${l.counterpart} lent you ${formatMoney(l.amount, l.currency)}`,
        sub:
          l.status === "settled"
            ? "Settled"
            : l.note
              ? `You owe — ${l.note}`
              : "You owe",
        tab: "lending",
      });
    }
    for (const b of billsApi.bills) {
      if (b.creatorId === userId) continue;
      const mine = b.shares.find((s) => s.userId === userId && !s.isCreator);
      if (!mine) continue;
      const creator = b.shares.find((s) => s.isCreator)?.name || "Someone";
      out.push({
        id: `bill:${b.id}`,
        at: b.at,
        icon: "receipt",
        title: `${creator} split "${b.title || "a bill"}" with you`,
        sub: mine.paid
          ? "Your share is settled"
          : `You owe ${formatMoney(mine.amount, b.currency)}`,
        tab: "split",
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [loans.loans, billsApi.bills, userId]);

  function markSeen() {
    const now = Date.now();
    setSeen(now);
    try {
      localStorage.setItem(`sw-notif-seen-${userId}`, String(now));
    } catch {}
  }

  function openFromNotif(tab: NotifTab) {
    setActive(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Roll loans + bills into "you're owed" / "you owe" totals for the hero.
  const { owed, owing } = useMemo(() => {
    const owedMap: Record<string, number> = {};
    const owingMap: Record<string, number> = {};
    for (const l of loans.loans) {
      if (l.status !== "active") continue;
      if (l.direction === "out") addInto(owedMap, l.currency, l.amount);
      else addInto(owingMap, l.currency, l.amount);
    }
    for (const b of billsApi.bills) {
      const iAmCreator = b.creatorId === userId;
      for (const s of b.shares) {
        if (s.isCreator || s.paid) continue;
        if (iAmCreator) addInto(owedMap, b.currency, s.amount);
        else if (s.userId === userId) addInto(owingMap, b.currency, s.amount);
      }
    }
    return { owed: owedMap, owing: owingMap };
  }, [loans.loans, billsApi.bills, userId]);

  function handleDelete(id: string) {
    const removed = removeLocal(id);
    if (!removed) return;
    toast.show("Entry deleted", {
      actionLabel: "Undo",
      onUndo: () => restore(removed),
      onCommit: () => commitDelete(id),
    });
  }

  function changeTab(t: TabKey) {
    setActive(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const firstName = myName.split(/\s+/)[0];

  return (
    <>
      <div className="hero">
        <header className="app-header">
          <div className="header-row">
            <div className="header-greet">
              <Avatar name={myName} size={42} />
              <div>
                <h1>Hi, {firstName}</h1>
                <p className="tagline">Know where your money goes.</p>
              </div>
            </div>
            <div className="header-actions">
              <NotificationBell
                items={notifications}
                seen={seen}
                onOpen={markSeen}
                onNavigate={openFromNotif}
              />
              <ThemeToggle />
              <button className="link-btn" onClick={() => supabase.auth.signOut()} title={email}>
                Sign out
              </button>
            </div>
          </div>
        </header>

        <Summary
          txns={txns}
          owed={owed}
          owing={owing}
          range={range}
          onToggleRange={() => setRange(range === "month" ? "all" : "month")}
        />
      </div>

      <main>
        <div className={`tab-panel ${active === "add" ? "active" : ""}`}>
          <AddTab
            txns={txns}
            loaded={loaded}
            add={add}
            addLoan={loans.add}
            onDelete={handleDelete}
            onEdit={setEditing}
            onToggleSettle={toggleSettled}
          />
        </div>
        <div className={`tab-panel ${active === "spending" ? "active" : ""}`}>
          <SpendingTab txns={txns} loaded={loaded} onDelete={handleDelete} onEdit={setEditing} />
        </div>
        <div className={`tab-panel ${active === "lending" ? "active" : ""}`}>
          <LendingTab
            supabase={supabase}
            uid={userId}
            loans={loans.loans}
            loaded={loans.loaded}
            add={loans.add}
            toggleSettled={loans.toggleSettled}
            remove={loans.remove}
          />
        </div>
        <div className={`tab-panel ${active === "split" ? "active" : ""}`}>
          <SplitTab
            supabase={supabase}
            uid={userId}
            myName={myName}
            bills={billsApi.bills}
            loaded={billsApi.loaded}
            create={billsApi.create}
            setPaid={billsApi.setPaid}
            remove={billsApi.remove}
          />
        </div>
        <div className={`tab-panel ${active === "export" ? "active" : ""}`}>
          <ExportTab txns={txns} />
        </div>
      </main>

      <TabBar active={active} onChange={changeTab} />

      {editing && (
        <EditSheet
          txn={editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            handleDelete(editing.id);
            setEditing(null);
          }}
          onSave={(patch) => {
            update(editing.id, patch);
            setEditing(null);
            toast.show("Saved ✓");
          }}
        />
      )}
    </>
  );
}
