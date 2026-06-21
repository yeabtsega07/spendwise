"use client";

import type { ReactNode } from "react";

export type TabKey = "add" | "spending" | "lending" | "split" | "export";

interface Props {
  active: TabKey;
  onChange: (t: TabKey) => void;
}

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<TabKey, ReactNode> = {
  add: (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  ),
  spending: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M5 21V11M12 21V4M19 21v-6" />
      <path d="M3 21h18" />
    </svg>
  ),
  lending: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  split: (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="8" cy="8" r="3.2" />
      <circle cx="16" cy="16" r="3.2" />
      <path d="M16.5 4.5 7.5 19.5" />
    </svg>
  ),
  export: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 15V4M8 8l4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "add", label: "Add" },
  { key: "spending", label: "Spending" },
  { key: "lending", label: "Lending" },
  { key: "split", label: "Split" },
  { key: "export", label: "Export" },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab-btn ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
          aria-label={t.label}
        >
          {ICONS[t.key]}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
