import { ASSESSMENT, sourceByKey, SourceKey } from '../config';

export type Side = 'Buyer' | 'Listing';

export interface Deal {
  id: string;
  address: string;
  closeDate: string; // yyyy-mm-dd
  price: number;
  side: Side;
  fromDual: boolean;
  clientName: string;
  source: SourceKey | '';
  sourceDetail: string;
  commissionPct: string; // entered as a percent, e.g. "2.5"
  netIncome: string; // dollars, as typed
  excluded: boolean;
  pending?: boolean; // added by hand: expected to close later in the assessment year
}

export type Step = 'instructions' | 'upload' | 'enrich' | 'review' | 'expenses' | 'done';

export interface SavedState {
  deals: Deal[];
  fileNames: string[];
  step: Step;
  index: number;
  reachedReview: boolean;
  submittedAt?: string | null;
  sheetUrl?: string | null; // the Google Sheet made from the latest workbook
  expenses?: Record<string, { amount: string; name?: string }>;
  expensesSkipped?: boolean; // the agent chose to skip the Expenses step
}

export const toNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const cleaned = v.replace(/[$,%\s]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
};

export const pctNumber = (deal: Deal) => toNumber(deal.commissionPct);

export const gci = (deal: Deal): number | null => {
  const p = pctNumber(deal);
  return p === null ? null : Math.round(deal.price * (p / 100) * 100) / 100;
};

export const missingFields = (deal: Deal): string[] => {
  if (deal.excluded) return [];
  const missing: string[] = [];
  if (deal.pending) {
    if (!deal.address.trim()) missing.push('Address');
    if (!deal.closeDate) missing.push('Closing date');
    if (!(deal.price > 0)) missing.push('Price');
  }
  if (!deal.clientName.trim()) missing.push('Client');
  if (!deal.source) missing.push('Source');
  const src = sourceByKey(deal.source);
  if (src?.detailRequired && !deal.sourceDetail.trim()) missing.push(src.key === 'other' ? 'Source name' : 'Referrer');
  const p = pctNumber(deal);
  if (p === null || p <= 0) missing.push('Commission');
  return missing;
};

export const isComplete = (deal: Deal) => missingFields(deal).length === 0;

export const money = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined
    ? ''
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits });

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const workbookFileName = (agentName: string) =>
  `Business_Plan_${ASSESSMENT.year}_${agentName.trim().replace(/[^a-z0-9]+/gi, '_')}.xlsx`;

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Earliest closing date allowed for a deal added by hand (today, but never before the assessment year).
export const pendingMinDate = () => {
  const t = isoToday();
  return t < ASSESSMENT.start ? ASSESSMENT.start : t > ASSESSMENT.end ? ASSESSMENT.end : t;
};

export const newPendingDeal = (side: Side = 'Buyer'): Deal => ({
  id: 'p' + Math.random().toString(36).slice(2, 11),
  address: '',
  closeDate: '',
  price: 0,
  side,
  fromDual: false,
  clientName: '',
  source: '',
  sourceDetail: '',
  commissionPct: '',
  netIncome: '',
  excluded: false,
  pending: true,
});

// A hand-added deal with nothing filled in yet (dropped if the agent backs out).
export const isBlankPending = (d: Deal) =>
  !!d.pending && !d.address.trim() && !d.closeDate && !(d.price > 0) && !d.clientName.trim() && !d.source && !d.commissionPct;
