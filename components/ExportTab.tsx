"use client";

import { buildClaudePrompt, exportFilename, toCSV } from "@/lib/export";
import type { Txn } from "@/lib/types";
import Icon from "./Icon";
import { useToast } from "./Toast";

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportTab({ txns }: { txns: Txn[] }) {
  const toast = useToast();
  const empty = txns.length === 0;

  async function copyForClaude() {
    try {
      await navigator.clipboard.writeText(buildClaudePrompt(txns));
      toast.show("Copied! Paste it into claude.ai 📋", { duration: 5000 });
    } catch {
      toast.show("Couldn't copy — use a download below instead.");
    }
  }

  return (
    <>
      <div className="card">
        <h2>Analyze with Claude — free</h2>
        <p className="hint">
          Copy your data with a ready-made prompt, then paste it into{" "}
          <em>claude.ai</em>. Uses your Claude subscription, so there&apos;s no API cost.
        </p>
        <button className="btn primary full btn-icon" onClick={copyForClaude} disabled={empty}>
          <Icon name="copy" size={18} />
          Copy my data for Claude
        </button>
        <ol className="setup-steps" style={{ marginTop: 14 }}>
          <li>Tap the button above.</li>
          <li>
            Open <strong>claude.ai</strong> and start a new chat.
          </li>
          <li>Paste (Cmd/Ctrl + V) and send.</li>
        </ol>
      </div>

      <div className="card">
        <h2>Export &amp; backup</h2>
        <p className="hint">Download your data as a spreadsheet or a JSON backup.</p>
        <div className="export-btns">
          <button
            className="btn"
            disabled={empty}
            onClick={() => download(toCSV(txns), exportFilename("csv"), "text/csv;charset=utf-8")}
          >
            ⬇️ CSV (spreadsheet)
          </button>
          <button
            className="btn"
            disabled={empty}
            onClick={() =>
              download(JSON.stringify(txns, null, 2), exportFilename("json"), "application/json")
            }
          >
            ⬇️ JSON backup
          </button>
        </div>
        {empty && <p className="empty">Add some expenses first — then you can export them.</p>}
      </div>
    </>
  );
}
