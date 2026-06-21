"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import SetupNeeded from "@/components/SetupNeeded";
import AuthGate from "@/components/AuthGate";
import TrackerApp from "@/components/TrackerApp";
import { ToastProvider } from "@/components/Toast";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupNeeded />;
  if (!ready) return <div className="boot">Loading…</div>;
  if (!session) return <AuthGate supabase={getSupabaseBrowser()} />;

  return (
    <ToastProvider>
      <TrackerApp
        supabase={getSupabaseBrowser()}
        email={session.user.email ?? ""}
        userId={session.user.id}
        userMeta={session.user.user_metadata ?? null}
      />
    </ToastProvider>
  );
}
