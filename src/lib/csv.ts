import Papa from 'papaparse';
import { ASSESSMENT } from '../config';
import { Deal, Side, toNumber } from './types';

export interface ParseResult {
  deals: Deal[]; // deals inside the assessment window
  outOfRange: number; // deals found but closed outside the window
  found: boolean; // a Compass header row was found
}

const newId = () => Math.random().toString(36).slice(2, 11);

const toIsoDate = (raw: string): string | null => {
  const s = (raw || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const sidesFor = (raw: string): Side[] | null => {
  const s = (raw || '').toLowerCase();
  const buy = /buy|renter|tenant/.test(s);
  const sell = /sell|list|landlord/.test(s);
  if (s.includes('dual') || (buy && sell)) return ['Buyer', 'Listing'];
  if (sell) return ['Listing'];
  if (buy) return ['Buyer'];
  return null;
};

const fmtPct = (n: number) => String(Math.round(n * 1000) / 1000);

export const parseCompassCsv = async (file: File): Promise<ParseResult> => {
  const text = await file.text();
  const rows = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;

  const headerIdx = rows.findIndex((r) => {
    const cells = r.map((c) => (c || '').toLowerCase());
    return cells.some((c) => c.includes('close') && c.includes('date')) && cells.some((c) => c.includes('address'));
  });
  if (headerIdx === -1) return { deals: [], outOfRange: 0, found: false };

  const headers = rows[headerIdx].map((h) => (h || '').trim().toLowerCase());
  const find = (test: (h: string) => boolean) => headers.findIndex(test);

  const col = {
    date: find((h) => h.includes('close') && h.includes('date')),
    address: find((h) => h.includes('address')),
    type: find((h) => (h === 'type' || h.endsWith(' type')) && !h.includes('property')),
    side: find((h) => h.includes('side')),
    price: find((h) => h.includes('price') && !h.includes('list')),
    client: find((h) => h.includes('client') && !h.includes('source')),
    pct: find((h) => h.includes('commission') && (h.includes('%') || h.includes('rate') || h.includes('percent'))),
    gci: find((h) => h === 'gci' || h.includes('gross commission')),
    // "Your Net Commission" in the Business Tracker export (before deductions).
    net: find((h) => h === 'your net commission') !== -1
      ? find((h) => h === 'your net commission')
      : find((h) => h.includes('net') && /commission|income|agent|payout/.test(h)),
  };

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim() : '');
  const deals: Deal[] = [];
  let outOfRange = 0;

  for (const r of rows.slice(headerIdx + 1)) {
    const address = cell(r, col.address);
    const lower = address.toLowerCase();
    if (!address || address.startsWith('$') || /^[\d,.\s]+$/.test(address)) continue;
    if (lower.includes('total') || lower.includes('sales volume')) continue;
    if (cell(r, col.type).toLowerCase().includes('referral')) continue;

    const closeDate = toIsoDate(cell(r, col.date));
    if (!closeDate) continue;
    if (closeDate < ASSESSMENT.start || closeDate > ASSESSMENT.end) {
      outOfRange++;
      continue;
    }

    const price = toNumber(cell(r, col.price)) ?? 0;
    const sides = sidesFor(cell(r, col.side)) ?? ['Buyer'];
    const split = sides.length; // dual deals: totals are shared across both sides

    // GCI dollars are the source of truth: commission % = GCI / price.
    // On a dual deal the GCI covers both sides, so each side gets half.
    let pct: number | null = null;
    const gciVal = toNumber(cell(r, col.gci));
    if (gciVal !== null && gciVal > 0 && price > 0) pct = (gciVal / price / split) * 100;
    if (pct === null) {
      pct = toNumber(cell(r, col.pct));
      if (pct !== null && pct > 0 && pct < 0.2) pct = pct * 100; // stored as a decimal
    }
    const netVal = toNumber(cell(r, col.net));

    for (const side of sides) {
      deals.push({
        id: newId(),
        address,
        closeDate,
        price,
        side,
        fromDual: split > 1,
        clientName: cell(r, col.client),
        source: '',
        sourceDetail: '',
        commissionPct: pct !== null && pct > 0 ? fmtPct(pct) : '',
        netIncome: netVal !== null ? String(Math.round((netVal / split) * 100) / 100) : '',
        excluded: false,
      });
    }
  }
  return { deals, outOfRange, found: true };
};

// Drop deals already loaded from an earlier file (same address, date and side).
export const dedupe = (existing: Deal[], incoming: Deal[]) => {
  const key = (d: Deal) => `${d.address.toLowerCase()}|${d.closeDate}|${d.side}`;
  const seen = new Set(existing.map(key));
  return incoming.filter((d) => {
    const k = key(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export const sortDeals = (deals: Deal[]) =>
  [...deals].sort((a, b) => a.closeDate.localeCompare(b.closeDate) || a.side.localeCompare(b.side));
