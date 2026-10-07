import ExcelJS from 'exceljs';
import { ASSESSMENT, GOAL_YEAR, sourceByKey } from '../config';
import { Deal, toNumber } from './types';
import { amountOf, EXPENSE_GROUPS, ExpenseEntry, Expenses, itemKey, otherKey } from './expenses';

// ---------------------------------------------------------------
// Builds the finished Business Planning workbook in the browser.
// Layout and styling mirror the Business Planning Series template
// cell for cell: Arial 10, gridlines on, no fills, thin black borders
// on the deal tables, green highlight on filled-in values.
// ---------------------------------------------------------------

const FONT = 'Arial';
const BLACK = 'FF000000';
const GREEN = 'FFB7E1CD'; // the template's conditional-format highlight
const MIN_TABLE_ROWS = 10; // the template has 10 rows per deal table
const SPARE_ROWS = 2;

const CURRENCY = '"$"#,##0.00';
const PCT = '0.00%';
const DATE = 'mm/dd/yyyy';

// Source labels in the order the template lists them.
const SHEET_SOURCES = ['Past Clients & SOI', 'Open House', 'Leads', 'Referrals'];
const SOURCE_OF_BUSINESS_LIST = [...SHEET_SOURCES, 'Other'];

const ref = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

type Font = Partial<ExcelJS.Font>;
const f = (extra: Font = {}): Font => ({ name: FONT, size: 10, color: { argb: BLACK }, ...extra });
const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BLACK } };
const boxed: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

interface CellOpts {
  font?: Font;
  fmt?: string;
  border?: boolean;
  align?: Partial<ExcelJS.Alignment>;
  fill?: ExcelJS.Fill;
}

const put = (ws: ExcelJS.Worksheet, addr: string | [number, number], value: ExcelJS.CellValue | undefined, o: CellOpts = {}) => {
  const c = Array.isArray(addr) ? ws.getCell(addr[0], addr[1]) : ws.getCell(addr);
  if (value !== undefined) c.value = value;
  c.font = o.font ?? f();
  if (o.fmt) c.numFmt = o.fmt;
  if (o.border) c.border = boxed;
  if (o.align) c.alignment = o.align;
  if (o.fill) c.fill = o.fill;
  return c;
};

const formula = (s: string) => ({ formula: s });

// Sheet defaults the template uses (Google Sheets export).
const sheet = (wb: ExcelJS.Workbook, name: string, widths: number[]) => {
  const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: 15.75, defaultColWidth: 12.63 } });
  widths.forEach((w, i) => {
    const col = ws.getColumn(i + 1);
    col.width = w;
    col.font = f();
  });
  return ws;
};

const title = (ws: ExcelJS.Worksheet, range: string, text: string) => {
  ws.mergeCells(range);
  put(ws, range.split(':')[0], text, { font: f({ size: 15, bold: true }), align: { horizontal: 'center', vertical: 'middle' } });
};

const instructions = (ws: ExcelJS.Worksheet, range: string, text: string, vertical?: 'middle') => {
  ws.mergeCells(range);
  put(ws, range.split(':')[0], text, { align: { wrapText: true, horizontal: 'left', vertical } });
};

const greenWhenFilled = (ws: ExcelJS.Worksheet, ref: string, firstCell: string) => {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: [`LEN(TRIM(${firstCell}))>0`],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: GREEN }, fgColor: { argb: GREEN } } },
      },
    ],
  });
};

const toExcelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

interface AssessmentRefs {
  sheet: string;
  buyer: { first: number; last: number };
  listing: { first: number; last: number };
  summary: { count: number; avg: number; volume: number; gci: number; net: number };
}

// ---------------------------------------------------------------
// Tab 1: Assessment (template rows: title 1-2, note 3, buyer table from 4)
// ---------------------------------------------------------------
const buildAssessment = (wb: ExcelJS.Workbook, deals: Deal[], agentName: string): AssessmentRefs => {
  const name = `${ASSESSMENT.year} Assessment`;
  const ws = sheet(wb, name, [2.9, 20.6, 26.2, 14.8, 20.5, 13, 18.4, 23.8, 25.6, 64.1]);
  title(ws, 'C1:G2', `${ASSESSMENT.year} Assessment`);
  ws.getRow(1).height = 27;
  ws.getRow(2).height = 27;
  instructions(
    ws,
    'C3:I3',
    `${agentName}: these are all of your ${ASSESSMENT.year} transactions for both the Buyer Side and the Listing Side, with your GCI and agent net ` +
      'commission income, pulled from the Finance tab under Business Tracker. You can add more deals at the bottom of each chart if necessary, ' +
      'and the numbers below will update automatically.',
    'middle',
  );
  ws.getRow(3).height = 38.25;

  const headers = [
    'Client Name', 'Transaction Address', 'Closed Date', 'Closed Price', 'Commission %',
    'Source of Business', 'Gross Commission Income', 'Agent Net Commission Income',
  ];

  let r = 4;
  const table = (label: string, rows: Deal[], labelHeight: number) => {
    put(ws, [r, 3], label, { font: f({ bold: true }), align: { vertical: 'middle' } });
    ws.getRow(r).height = labelHeight;
    headers.forEach((h, i) => put(ws, [r + 1, 2 + i], h, { font: f({ bold: true }), border: true }));
    const first = r + 2;
    const count = Math.max(MIN_TABLE_ROWS, rows.length + SPARE_ROWS);
    for (let i = 0; i < count; i++) {
      const rowNum = first + i;
      const d = rows[i];
      const src = d ? sourceByKey(d.source) : undefined;
      const pct = d ? toNumber(d.commissionPct) : null;
      const net = d ? toNumber(d.netIncome) : null;
      put(ws, [rowNum, 1], formula(`IF(C${rowNum}="","",COUNTA(C$${first}:C${rowNum}))`), { font: f({ bold: i === 0 }) });
      put(ws, [rowNum, 2], d ? d.clientName.trim() : undefined, { border: true });
      put(ws, [rowNum, 3], d ? d.address + (d.fromDual ? ' (dual)' : '') : undefined, { border: true });
      put(ws, [rowNum, 4], d ? toExcelDate(d.closeDate) : undefined, { border: true, fmt: DATE });
      put(ws, [rowNum, 5], d ? d.price : undefined, { border: true, fmt: CURRENCY });
      put(ws, [rowNum, 6], pct !== null ? pct / 100 : undefined, { border: true, fmt: PCT });
      const g = put(ws, [rowNum, 7], src ? src.label : undefined, { border: true });
      g.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${SOURCE_OF_BUSINESS_LIST.join(',')}"`] };
      put(ws, [rowNum, 8], formula(`E${rowNum}*F${rowNum}`), { border: true, fmt: CURRENCY });
      put(ws, [rowNum, 9], net !== null ? net : undefined, { border: true, fmt: CURRENCY });
    }
    const last = first + count - 1;
    greenWhenFilled(ws, `E${first}:E${last}`, `E${first}`);
    r = last + 1;
    return { first, last };
  };

  const buyer = table('Buyer Side', deals.filter((d) => d.side === 'Buyer'), 27);
  const listing = table('Listing Side', deals.filter((d) => d.side === 'Listing'), 29.25);

  // Summary block: two blank rows, then the column headers (template rows 30-35).
  r += 2;
  ws.getRow(r).height = 20.25;
  ['Buyer Side', 'Listing Side', 'TOTAL'].forEach((h, i) =>
    put(ws, [r, 5 + i], h, { font: f({ bold: true }), align: { horizontal: 'center', vertical: 'middle' } }),
  );
  const B = (c: string) => `${c}${buyer.first}:${c}${buyer.last}`;
  const L = (c: string) => `${c}${listing.first}:${c}${listing.last}`;
  const lines: [string, string, string, string, string | undefined, boolean][] = [
    ['Number of Transactions', `COUNTA(${B('C')})`, `COUNTA(${L('C')})`, 'E{r}+F{r}', undefined, false],
    ['Average Sales Price', `IFERROR(AVERAGE(${B('E')}),0)`, `IFERROR(AVERAGE(${L('E')}),0)`, `IFERROR(AVERAGE(${B('E')},${L('E')}),0)`, CURRENCY, false],
    ['Total Sales Volume', `SUM(${B('E')})`, `SUM(${L('E')})`, 'SUM(E{r}:F{r})', CURRENCY, false],
    ['Total Gross Commission Income', `SUM(${B('H')})`, `SUM(${L('H')})`, 'E{r}+F{r}', CURRENCY, false],
    ['Total Agent Net Commission Income', `SUM(${B('I')})`, `SUM(${L('I')})`, 'SUM(E{r}:F{r})', CURRENCY, true],
  ];
  const rows: number[] = [];
  lines.forEach(([label, e, fm, g, fmt, boldTotal], i) => {
    const rowNum = r + 1 + i;
    rows.push(rowNum);
    ws.mergeCells(`C${rowNum}:D${rowNum}`);
    put(ws, [rowNum, 3], label, { font: f({ bold: true }) });
    put(ws, [rowNum, 5], formula(e), { fmt });
    put(ws, [rowNum, 6], formula(fm), { fmt });
    put(ws, [rowNum, 7], formula(g.replace(/\{r\}/g, String(rowNum))), { font: f({ italic: true, bold: boldTotal }), fmt });
  });
  greenWhenFilled(ws, `G${rows[0]}:G${rows[4]}`, `G${rows[0]}`);

  return {
    sheet: name,
    buyer,
    listing,
    summary: { count: rows[0], avg: rows[1], volume: rows[2], gci: rows[3], net: rows[4] },
  };
};

// Shared layout for both Sources of Business tabs.
// Template: section label (12 bold), header row (right-aligned), source rows,
// last source row with white fill, total row (bold italic), blank row.
interface SourceBlockOpts {
  labels: string[];
  label: string;
  totalLabel: string;
  totalLabelFont: Font;
  values: (i: number, rowNum: number) => ExcelJS.CellValue | undefined;
  labelValue?: (i: number) => ExcelJS.CellValue;
  extra?: { header: string; value: (i: number) => ExcelJS.CellValue; fmt: string };
}

const sourceBlock = (ws: ExcelJS.Worksheet, start: number, o: SourceBlockOpts) => {
  put(ws, [start, 1], o.label, { font: f({ size: 12, bold: true }) });
  put(ws, [start + 1, 2], 'Number of Sales', { align: { horizontal: 'right' } });
  put(ws, [start + 1, 3], 'Percentage', { align: { horizontal: 'right' } });
  if (o.extra) put(ws, [start + 1, 4], o.extra.header, { align: { horizontal: 'right' } });
  const first = start + 2;
  const totalRow = first + o.labels.length;
  o.labels.forEach((l, i) => {
    const rowNum = first + i;
    const isLast = i === o.labels.length - 1;
    put(ws, [rowNum, 1], o.labelValue ? o.labelValue(i) : l, isLast ? { align: { horizontal: 'left' } } : {});
    put(ws, [rowNum, 2], o.values(i, rowNum));
    put(ws, [rowNum, 3], formula(`IFERROR(B${rowNum}/B$${totalRow},0)`), {
      font: { name: '"Google Sans"', size: 10, color: { argb: 'FF1F1F1F' } },
      align: { horizontal: 'right' },
      fmt: PCT,
    });
    if (o.extra) put(ws, [rowNum, 4], o.extra.value(i), { fmt: o.extra.fmt });
  });
  put(ws, [totalRow, 1], o.totalLabel, { font: o.totalLabelFont });
  put(ws, [totalRow, 2], formula(`SUM(B${first}:B${totalRow - 1})`), { font: f({ bold: true, italic: true }) });
  put(ws, [totalRow, 3], formula(`SUM(C${first}:C${totalRow - 1})`), { font: f({ bold: true, italic: true }), fmt: PCT });
  if (o.extra) put(ws, [totalRow, 4], formula(`SUM(D${first}:D${totalRow - 1})`), { font: f({ bold: true, italic: true }), fmt: o.extra.fmt });
  return { first, totalRow, next: totalRow + 2 };
};

// ---------------------------------------------------------------
// Tab 2: Sources of business for the assessment year (automatic)
// ---------------------------------------------------------------
const buildSources = (wb: ExcelJS.Workbook, a: AssessmentRefs) => {
  const ws = sheet(wb, `My Sources of Business ${ASSESSMENT.year}`, [36.9, 20.9, 21.2, 20.9]);
  title(ws, 'A1:C2', `My Sources of Business for ${ASSESSMENT.year}`);
  instructions(
    ws,
    'A3:C3',
    `These numbers fill in automatically from your ${ASSESSMENT.year} Assessment tab. If you change a deal's Source of Business there, this page updates.`,
  );
  ws.getRow(3).height = 27;

  const S = ref(a.sheet);
  const labels = [...SHEET_SOURCES, 'Other'];
  const rng = (col: string, t: { first: number; last: number }) => `${S}!$${col}$${t.first}:$${col}$${t.last}`;
  const vol = (t: { first: number; last: number }) => (i: number) => formula(`SUMIF(${rng('G', t)},"${labels[i]}",${rng('E', t)})`);

  const buyer = sourceBlock(ws, 4, {
    labels,
    label: 'Buyer Side',
    totalLabel: 'TOTAL Buyers',
    totalLabelFont: f({ bold: true, italic: true }),
    values: (i) => formula(`COUNTIF(${rng('G', a.buyer)},"${labels[i]}")`),
    extra: { header: 'Sales Volume', value: vol(a.buyer), fmt: CURRENCY },
  });
  const seller = sourceBlock(ws, buyer.next, {
    labels,
    label: 'Seller Side',
    totalLabel: 'TOTAL Listings',
    totalLabelFont: f({ italic: true }),
    values: (i) => formula(`COUNTIF(${rng('G', a.listing)},"${labels[i]}")`),
    extra: { header: 'Sales Volume', value: vol(a.listing), fmt: CURRENCY },
  });
  sourceBlock(ws, seller.next, {
    labels,
    label: 'Total Sales',
    totalLabel: 'TOTAL Sales',
    totalLabelFont: f(),
    values: (i) => formula(`B${buyer.first + i}+B${seller.first + i}`),
    extra: { header: 'Sales Volume', value: (i) => formula(`D${buyer.first + i}+D${seller.first + i}`), fmt: CURRENCY },
  });
};

// ---------------------------------------------------------------
// Tab 3: Expenses (filled in during the session)
// ---------------------------------------------------------------
const buildExpenses = (wb: ExcelJS.Workbook, expenses: Expenses) => {
  const ws = sheet(wb, 'My Expenses', [37.9, 25.5]);
  title(ws, 'A1:B2', `Expenses ${ASSESSMENT.year}`);
  instructions(
    ws,
    'A3:B3',
    'Instructions: fill up the annual Expense Amount ($) for each of these categories at the best of your knowledge. This will help us budget for the new year!',
  );
  ws.getRow(3).height = 40;
  // [label, saved answer] per row, in template order: named categories, then three "Other Expenses" rows.
  const groups: [string, [string, ExpenseEntry | undefined][]][] = EXPENSE_GROUPS.map((g) => [
    g.totalLabel,
    [
      ...g.items.map((label, i): [string, ExpenseEntry | undefined] => [label, expenses[itemKey(g.key, i)]]),
      ...Array.from({ length: g.others }, (_, i): [string, ExpenseEntry | undefined] => {
        const e = expenses[otherKey(g.key, i)];
        return [e?.name?.trim() || 'Other Expenses', e];
      }),
    ],
  ]);
  let r = 4;
  const totals: number[] = [];
  groups.forEach(([totalLabel, items], gi) => {
    const first = r;
    for (const [label, entry] of items) {
      put(ws, [r, 1], label, { align: { wrapText: true } });
      const amt = amountOf(entry);
      put(ws, [r, 2], amt !== null ? amt : undefined, { fmt: CURRENCY });
      r++;
    }
    const lastGroup = gi === groups.length - 1;
    const bottom: Partial<ExcelJS.Borders> | undefined = lastGroup ? undefined : { bottom: thin };
    const a = put(ws, [r, 1], totalLabel, { font: f({ bold: true, italic: true }), align: { wrapText: true } });
    const b = put(ws, [r, 2], formula(`SUM(B${first}:B${r - 1})`), { font: f({ italic: true }), fmt: CURRENCY });
    if (bottom) {
      a.border = bottom;
      b.border = bottom;
    }
    totals.push(r);
    r++;
  });
  ws.getRow(r).height = 12.75;
  r++;
  ws.getRow(r).height = 30;
  put(ws, [r, 1], 'TOTAL', { font: f({ bold: true }), align: { horizontal: 'right', vertical: 'middle' } });
  put(ws, [r, 2], formula(totals.map((t) => `B${t}`).join('+')), {
    font: f({ bold: true, italic: true }),
    align: { vertical: 'middle' },
    fmt: CURRENCY,
  });
};

// ---------------------------------------------------------------
// Tab 4: Goals for next year
// ---------------------------------------------------------------
const buildGoals = (wb: ExcelJS.Workbook, a: AssessmentRefs) => {
  const ws = sheet(wb, `Goals ${GOAL_YEAR}`, [26.2, 14.8, 20.5, 20.1, 36.4, 63.6]);
  title(ws, 'A1:E2', `GOALS ${GOAL_YEAR}`);
  ws.getRow(2).height = 29.25;
  instructions(
    ws,
    'A3:E4',
    `Instructions: Make sure to indicate the amount of transactions you would like to achieve on each side of the transaction and what is the average price per the assessment you made for the year ${ASSESSMENT.year}. All the numbers should autopopulate once you add these two numbers in the appropriate fields.`,
  );
  ws.getRow(4).height = 20.25;

  put(ws, 'C6', 'Buyer Side');
  put(ws, 'D6', 'Listing Side');
  put(ws, 'E6', 'Total', { font: f({ italic: true }), align: { horizontal: 'right' } });
  const S = ref(a.sheet);
  const rows: [string, string | null, string | null, string, string | undefined, boolean][] = [
    ['Number of Transactions', null, null, 'C7+D7', undefined, false],
    ['Average Sales Price', `${S}!E${a.summary.avg}`, `${S}!F${a.summary.avg}`, 'IFERROR(E9/E7,0)', CURRENCY, false],
    ['Total Sales Volume', 'IF(OR(C7="",C8=""),0,C7*C8)', 'IF(OR(D7="",D8=""),0,D7*D8)', 'SUM(C9:D9)', CURRENCY, false],
    ['Total Gross Commission Income', null, null, 'SUM(C10:D10)', CURRENCY, false],
    ['Total Net Commission Income', null, null, 'SUM(C11:D11)', CURRENCY, true],
  ];
  rows.forEach(([label, c, d, e, fmt, boldTotal], i) => {
    const r = 7 + i;
    ws.mergeCells(`A${r}:B${r}`);
    put(ws, [r, 1], label, { font: f({ bold: true }) });
    put(ws, [r, 3], c ? formula(c) : undefined, { fmt });
    put(ws, [r, 4], d ? formula(d) : undefined, { fmt });
    put(ws, [r, 5], formula(e), { font: f({ italic: true, bold: boldTotal }), fmt });
  });
};

// ---------------------------------------------------------------
// Tab 5: Target sources of business for next year
// ---------------------------------------------------------------
const buildSourceGoals = (wb: ExcelJS.Workbook) => {
  const ws = sheet(wb, `My Sources of Business ${GOAL_YEAR}`, [36.9, 14.9, 14.4]);
  title(ws, 'A1:C2', `My Sources of Business for ${GOAL_YEAR}`);
  const labels = [...SHEET_SOURCES, 'Other (name them here)', 'Other (name them here)'];
  const buyer = sourceBlock(ws, 3, {
    labels,
    label: 'Buyer Side',
    totalLabel: 'TOTAL Buyers',
    totalLabelFont: f({ bold: true, italic: true }),
    values: () => undefined,
  });
  const seller = sourceBlock(ws, buyer.next, {
    labels,
    label: 'Seller Side',
    totalLabel: 'TOTAL Listings',
    totalLabelFont: f({ italic: true }),
    values: () => undefined,
  });
  sourceBlock(ws, seller.next, {
    labels,
    label: 'Total Sales',
    totalLabel: 'TOTAL Sales',
    totalLabelFont: f(),
    values: (i) => formula(`B${buyer.first + i}+B${seller.first + i}`),
    // Total Sales rows reuse whatever names the agent typed in the Buyer Side "Other" rows.
    labelValue: (i) => (i >= SHEET_SOURCES.length ? formula(`A${buyer.first + i}`) : labels[i]),
  });
};

export const buildWorkbook = async (
  allDeals: Deal[],
  agent: { name: string; email: string },
  expenses: Expenses = {},
): Promise<ArrayBuffer> => {
  const deals = allDeals.filter((d) => !d.excluded).sort((x, y) => x.closeDate.localeCompare(y.closeDate));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Compass Business Planning Series';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  const a = buildAssessment(wb, deals, agent.name);
  buildSources(wb, a);
  buildExpenses(wb, expenses);
  buildGoals(wb, a);
  buildSourceGoals(wb);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
};
