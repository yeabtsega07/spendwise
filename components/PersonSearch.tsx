"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchProfiles } from "@/lib/directory";
import type { Profile } from "@/lib/types";
import Avatar from "./Avatar";

/** A chosen person — `id`/`email` present when they're a real SpendWise user. */
export interface Picked {
  id?: string;
  name: string;
  email?: string;
}

interface Props {
  supabase: SupabaseClient;
  excludeId?: string;
  value: Picked | null;
  onChange: (p: Picked | null) => void;
  placeholder?: string;
  /** When false, a non-matching name can't be used (split needs real names too,
   *  but lending allows off-platform names). Defaults to true. */
  allowName?: boolean;
}

export default function PersonSearch({
  supabase,
  excludeId,
  value,
  onChange,
  placeholder = "Type a name or email…",
  allowName = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced directory lookup.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchProfiles(supabase, term, excludeId);
      setResults(found);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, supabase, excludeId]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(p: Picked) {
    onChange(p);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (value) {
    return (
      <div className="person-chip">
        <Avatar name={value.name} size={34} linked={!!value.id} />
        <div className="person-chip-body">
          <span className="person-chip-name">{value.name}</span>
          <span className="person-chip-sub">
            {value.id ? value.email : "Not on SpendWise — tracked by name"}
          </span>
        </div>
        <button
          type="button"
          className="person-chip-x"
          onClick={() => onChange(null)}
          aria-label="Clear"
        >
          ×
        </button>
      </div>
    );
  }

  const term = query.trim();
  const exactName = results.some(
    (r) => r.displayName.toLowerCase() === term.toLowerCase()
  );

  return (
    <div className="person-search" ref={boxRef}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        inputMode="email"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && term.length >= 2 && (
        <div className="person-results">
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              className="person-result"
              onClick={() => pick({ id: r.id, name: r.displayName, email: r.email })}
            >
              <Avatar name={r.displayName} size={32} linked />
              <div className="person-result-body">
                <span className="person-result-name">{r.displayName}</span>
                <span className="person-result-email">{r.email}</span>
              </div>
              <span className="person-linked-tag">On SpendWise</span>
            </button>
          ))}
          {searching && <div className="person-hint">Searching…</div>}
          {!searching && !results.length && (
            <div className="person-hint">No SpendWise user found</div>
          )}
          {allowName && !exactName && (
            <button
              type="button"
              className="person-result as-name"
              onClick={() => pick({ name: term })}
            >
              <Avatar name={term} size={32} />
              <div className="person-result-body">
                <span className="person-result-name">Use “{term}”</span>
                <span className="person-result-email">as a name (off SpendWise)</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
