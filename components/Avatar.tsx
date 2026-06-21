"use client";

/** Deterministic initials + colour from a name, for a small round avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const HUES = [210, 260, 330, 12, 32, 150, 190, 280];

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

interface Props {
  name: string;
  size?: number;
  linked?: boolean;
}

export default function Avatar({ name, size = 38, linked }: Props) {
  const h = hue(name || "?");
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${h} 70% 52%), hsl(${(h + 28) % 360} 72% 44%))`,
      }}
      aria-hidden
    >
      {initials(name)}
      {linked && <span className="avatar-dot" title="On SpendWise" />}
    </span>
  );
}
