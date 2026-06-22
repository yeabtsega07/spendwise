"use client";

import { useState } from "react";
import Icon, { type IconName } from "./Icon";

export type NotifTab = "lending" | "split";

export interface Notif {
  id: string;
  at: number;
  icon: IconName;
  title: string;
  sub: string;
  tab: NotifTab;
}

function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString();
}

interface Props {
  items: Notif[];
  seen: number;
  onOpen: () => void;
  onNavigate: (tab: NotifTab) => void;
}

export default function NotificationBell({ items, seen, onOpen, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  // Freeze the "seen" line when the panel opens, so the items that were unread
  // keep their dot while you read them (instead of clearing instantly).
  const [snapshotSeen, setSnapshotSeen] = useState(0);

  const unread = items.filter((n) => n.at > seen).length;

  function openPanel() {
    setSnapshotSeen(seen);
    setOpen(true);
    onOpen();
  }

  return (
    <>
      <button
        className="notif-bell link-btn"
        onClick={openPanel}
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="sheet-overlay" onClick={() => setOpen(false)}>
          <div className="sheet notif-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="notif-head">
              <h2>Notifications</h2>
              <button className="notif-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            {items.length ? (
              <ul className="notif-list">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      className={`notif-item ${n.at > snapshotSeen ? "is-new" : ""}`}
                      onClick={() => {
                        onNavigate(n.tab);
                        setOpen(false);
                      }}
                    >
                      <span className="notif-icon">
                        <Icon name={n.icon} size={19} />
                      </span>
                      <span className="notif-body">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-sub">{n.sub}</span>
                      </span>
                      <span className="notif-meta">
                        <span className="notif-time">{timeAgo(n.at)}</span>
                        {n.at > snapshotSeen && <span className="notif-dot" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="notif-empty">
                <span className="empty-icon">
                  <Icon name="bell" size={24} />
                </span>
                <span className="empty-title">You&apos;re all caught up</span>
                <span className="empty-sub">
                  Loan and split-bill requests from others will show up here.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
