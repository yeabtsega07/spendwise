export type Kind = "expense" | "loan";

export interface Txn {
  id: string;
  at: number; // creation timestamp (ms) — used for stable sorting
  kind: Kind;
  amount: number;
  currency: string; // ISO-ish code, e.g. "ETB", "USD"
  note: string;
  person?: string; // for loans: who you lent to
  category?: string; // for expenses
  date: string; // YYYY-MM-DD
  settled?: boolean; // for loans: repaid?
}

export interface ParsedEntry {
  kind: Kind;
  amount: number;
  currency: string;
  note: string;
  person: string;
  category: string;
}

/** A user in the directory — found by typing their email. */
export interface Profile {
  id: string;
  email: string;
  displayName: string;
}

/**
 * A loan between two people. The same row is visible to both the lender and
 * the borrower (when the borrower is a real user), so it shows on both screens.
 * `direction` and `counterpart` are derived for whoever is currently viewing.
 */
export interface Loan {
  id: string;
  at: number;
  lenderId: string;
  lenderName: string;
  borrowerId?: string;
  borrowerName: string;
  amount: number;
  currency: string;
  note: string;
  date: string;
  status: "active" | "settled";
  // Derived for the current viewer:
  direction: "out" | "in"; // "out" = you lent it; "in" = you owe it
  counterpart: string; // the other person's name
  linked: boolean; // true when the other person is a real SpendWise user
}

export interface BillShare {
  id: string;
  userId?: string;
  name: string;
  amount: number;
  paid: boolean;
  isCreator: boolean;
}

/** A split bill: the creator paid `total`, split into `shares`. */
export interface Bill {
  id: string;
  at: number;
  creatorId: string;
  title: string;
  currency: string;
  total: number;
  date: string;
  shares: BillShare[];
}
