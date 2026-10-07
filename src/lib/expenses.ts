// Expense categories from the Business Planning Series template's "My Expenses" tab,
// in the same order. Both the Expenses screen and the workbook read from this list.

export interface ExpenseGroup {
  key: string;
  title: string; // shown in the app
  totalLabel: string; // the template's total row label
  items: string[]; // named categories
  others: number; // "Other Expenses" rows the agent can name
}

export const EXPENSE_GROUPS: ExpenseGroup[] = [
  {
    key: 'marketing',
    title: 'Marketing',
    totalLabel: 'TOTAL Marketing Expenses',
    items: ['Print & Digital', 'Events', 'PopBys', 'Client Lunches & Coffees'],
    others: 3,
  },
  {
    key: 'listing',
    title: 'Listing',
    totalLabel: 'TOTAL Listing Expenses',
    items: ['Photography', 'Staging', 'Cleaning Services', 'Marketing'],
    others: 3,
  },
  {
    key: 'general',
    title: 'General business',
    totalLabel: 'TOTAL General Business Expenses',
    items: ['Resource Fee', 'E&O Insurance', 'Bright Fees', 'Association Fees', 'CE Classes', 'License Renewals'],
    others: 3,
  },
  {
    key: 'networking',
    title: 'Networking & travel',
    totalLabel: 'TOTAL Networking & Travel Expenses ',
    items: ['Retreat', 'Networking + Training Events', 'Travel Fees'],
    others: 3,
  },
];

// Saved answers. Amounts are kept as typed; "Other" rows also keep a name.
export interface ExpenseEntry {
  amount: string;
  name?: string;
}
export type Expenses = Record<string, ExpenseEntry>;

export const itemKey = (group: string, i: number) => `${group}.${i}`;
export const otherKey = (group: string, i: number) => `${group}.other${i}`;

export const amountOf = (e?: ExpenseEntry): number | null => {
  if (!e || !e.amount) return null;
  const n = Number(e.amount.replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : null;
};

export const groupTotal = (expenses: Expenses, g: ExpenseGroup) => {
  let t = 0;
  g.items.forEach((_, i) => (t += amountOf(expenses[itemKey(g.key, i)]) ?? 0));
  for (let i = 0; i < g.others; i++) t += amountOf(expenses[otherKey(g.key, i)]) ?? 0;
  return t;
};

export const expensesTotal = (expenses: Expenses) => EXPENSE_GROUPS.reduce((s, g) => s + groupTotal(expenses, g), 0);
