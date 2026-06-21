import type { IconName } from "@/components/Icon";

export interface Category {
  key: string;
  icon: IconName;
  color: string;
  words: string[];
}

export const CATEGORIES: Category[] = [
  { key: "Food", icon: "food", color: "#f59e0b", words: ["gum", "coffee", "tea", "lunch", "dinner", "breakfast", "food", "snack", "snacks", "restaurant", "cafe", "drink", "water", "juice", "meal", "groceries", "grocery", "bread", "injera"] },
  { key: "Transport", icon: "transport", color: "#3b82f6", words: ["ride", "taxi", "bus", "uber", "bolt", "fuel", "gas", "transport", "train", "flight", "fare", "bajaj"] },
  { key: "Subscriptions", icon: "subscriptions", color: "#8b5cf6", words: ["subscription", "subscriptions", "sub", "claude", "netflix", "spotify", "chatgpt", "youtube", "prime", "icloud", "adobe"] },
  { key: "Bills", icon: "bills", color: "#ef4444", words: ["rent", "electric", "electricity", "internet", "wifi", "phone", "airtime", "bill", "bills", "utility"] },
  { key: "Shopping", icon: "shopping", color: "#ec4899", words: ["clothes", "shoes", "shopping", "shirt", "gift", "gifts"] },
  { key: "Health", icon: "health", color: "#10b981", words: ["medicine", "pharmacy", "doctor", "hospital", "clinic", "health"] },
  { key: "Fun", icon: "fun", color: "#06b6d4", words: ["movie", "game", "games", "party", "bar", "beer", "fun", "cinema"] },
  { key: "Other", icon: "other", color: "#64748b", words: [] },
];

const CATEGORY_ICON: Record<string, IconName> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.icon])
);
const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.color])
);

export const LOAN_COLOR = "#0d9488";

export function categoryIcon(key?: string): IconName {
  return (key && CATEGORY_ICON[key]) || "other";
}

export function categoryColor(key?: string): string {
  return (key && CATEGORY_COLOR[key]) || "#64748b";
}

export function inferCategory(note: string): string {
  const lower = note.toLowerCase();
  const tokens = lower.split(/\s+/);
  for (const cat of CATEGORIES) {
    if (cat.key === "Other") continue;
    if (cat.words.some((w) => tokens.includes(w) || lower.includes(w))) return cat.key;
  }
  return "Other";
}
