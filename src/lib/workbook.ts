import ExcelJS from 'exceljs';
import { ASSESSMENT, GOAL_YEAR, sourceByKey } from '../config';
import { Deal, toNumber } from './types';
import { amountOf, EXPENSE_GROUPS, ExpenseEntry, Expenses, itemKey, otherKey } from './expenses';
import { MARK_PNG_BASE64 } from './brandMark';

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
const CURRENCY_HIDE_ZERO = '"$"#,##0.00;-"$"#,##0.00;""'; // blank instead of $0.00
const PCT = '0.00%';
const DATE = 'mm/dd/yyyy';

// Source labels in the order the template lists them.
const SHEET_SOURCES = ['Past Clients & SOI', 'Open House', 'Leads', 'Referrals'];
const SOURCE_OF_BUSINESS_LIST = [...SHEET_SOURCES, 'Other'];

const ref = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

// ---------------------------------------------------------------
// Optional Compass-branded look, matching the app. Only styling changes:
// cells, formulas, dropdowns and tab layout are identical either way.
// ---------------------------------------------------------------
let BRAND = false;
let MARK_ID: number | null = null;
const BR = {
  ink: 'FF000000',
  white: 'FFFFFFFF',
  mist: 'FFEEF2F6',
  line: 'FFD7DDE4',
  slate: 'FF5B6470',
  input: 'FFE8F1FD',
  soft: 'FFF7F9FB',
};
// Lighter versions of the app's source colors, readable behind black text.
const SOURCE_TINT: Record<string, string> = {
  'Past Clients & SOI': 'FFCEDFF4',
  Referrals: 'FFCFEADE',
  'Open House': 'FFF9EAC9',
  Leads: 'FFE1D9F6',
  Other: 'FFF8D9D7',
};
const tintFor = (label: string) => SOURCE_TINT[label.startsWith('Other') ? 'Other' : label];
type Role = 'header' | 'section' | 'cell' | 'label' | 'sub' | 'total' | 'grand' | 'input';

type Font = Partial<ExcelJS.Font>;
const BRAND_FONT = 'DM Sans';
const f = (extra: Font = {}): Font => ({ name: BRAND ? BRAND_FONT : FONT, size: 10, color: { argb: BLACK }, ...extra });
const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BLACK } };
const boxed: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

interface CellOpts {
  font?: Font;
  fmt?: string;
  border?: boolean;
  align?: Partial<ExcelJS.Alignment>;
  fill?: ExcelJS.Fill;
  role?: Role; // used only by the branded look
  tint?: string; // branded: source color behind a label
}

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const lightLine: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BR.line } };
const lightBox: Partial<ExcelJS.Borders> = { top: lightLine, left: lightLine, bottom: lightLine, right: lightLine };

const applyBrand = (c: ExcelJS.Cell, o: CellOpts) => {
  const font = { ...(c.font || {}) } as Font;
  if (o.border) c.border = lightBox;
  switch (o.role) {
    case 'header':
      c.fill = solid(BR.mist);
      c.font = { ...font, bold: true, italic: false, color: { argb: BR.ink } };
      c.border = { ...lightBox, bottom: { style: 'thin', color: { argb: 'FF9AA4AF' } } };
      c.alignment = { ...(c.alignment || {}), vertical: 'middle', wrapText: true };
      break;
    case 'section':
      c.font = { ...font, size: 12, bold: true, italic: false, color: { argb: BR.ink } };
      c.alignment = { ...(c.alignment || {}), vertical: 'bottom' };
      break;
    case 'sub':
      c.font = { ...font, bold: true, color: { argb: BR.slate } };
      c.border = { bottom: { style: 'thin', color: { argb: BR.ink } } };
      break;
    case 'cell':
    case 'label':
      c.border = lightBox;
      break;
    case 'input':
      c.fill = solid(BR.input);
      c.border = lightBox;
      break;
    case 'total':
      c.fill = solid(BR.soft);
      c.font = { ...font, bold: true, italic: false };
      c.border = lightBox;
      break;
    case 'grand':
      c.fill = solid(BR.mist);
      c.font = { ...font, size: 11, bold: true, italic: false, color: { argb: BR.ink } };
      c.border = { top: { style: 'thin', color: { argb: 'FF9AA4AF' } }, bottom: { style: 'thin', color: { argb: 'FF9AA4AF' } } };
      break;
  }
  if (o.tint) {
    c.fill = solid(o.tint);
    c.border = lightBox;
  }
  if (o.border || (o.role && o.role !== 'section') || o.tint) {
    // Explicit left/right on every table cell so the inner padding applies the same way everywhere:
    // text left, numbers / dates / formulas right (headers set their own to match their column).
    const v: any = c.value;
    const isText = typeof v === 'string';
    const horizontal = c.alignment?.horizontal ?? (v === null || v === undefined ? undefined : isText ? 'left' : 'right');
    c.alignment = { ...(c.alignment || {}), ...(horizontal ? { horizontal } : {}), vertical: 'middle', indent: 1 };
  }
};

const put = (ws: ExcelJS.Worksheet, addr: string | [number, number], value: ExcelJS.CellValue | undefined, o: CellOpts = {}) => {
  const c = Array.isArray(addr) ? ws.getCell(addr[0], addr[1]) : ws.getCell(addr);
  if (value !== undefined) c.value = value;
  c.font = o.font ?? f();
  if (o.fmt) c.numFmt = o.fmt;
  if (o.border) c.border = boxed;
  if (o.align) c.alignment = o.align;
  if (o.fill) c.fill = o.fill;
  if (BRAND) applyBrand(c, o);
  return c;
};

const formula = (s: string) => ({ formula: s });

// Sheet defaults the template uses (Google Sheets export).
const sheet = (wb: ExcelJS.Workbook, name: string, widths: number[]) => {
  const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: BRAND ? 19 : 15.75, defaultColWidth: 12.63 } });
  widths.forEach((w, i) => {
    const col = ws.getColumn(i + 1);
    col.width = w;
    col.font = f();
  });
  return ws;
};

// brandRange: the branded title bar spans the full width of the tab's content.
// Title bar's first column per tab, for placing the logo after layout is done.
const markStart = new Map<ExcelJS.Worksheet, number>();
const colPx = (ws: ExcelJS.Worksheet, c: number) => (ws.getColumn(c).width ?? 8.43) * 7 + 5;
const rowPx = (ws: ExcelJS.Worksheet, r: number) => ((ws.getRow(r).height ?? 15.75) * 96) / 72;
// Logo: 10px in from the title bar's left edge and centered on the bar's height (rows 1-2).
const placeMark = (ws: ExcelJS.Worksheet) => {
  const start = markStart.get(ws);
  if (MARK_ID === null || start === undefined) return;
  const size = 30;
  const barH = rowPx(ws, 1) + rowPx(ws, 2);
  const top = Math.max(0, (barH - size) / 2);
  // Exact offsets (in EMUs, 9525 per pixel) so every app places it the same way.
  const EMU = 9525;
  const r0 = top < rowPx(ws, 1) ? 0 : 1;
  const rowOff = (r0 === 0 ? top : top - rowPx(ws, 1)) * EMU;
  ws.addImage(MARK_ID, {
    tl: { nativeCol: start - 1, nativeColOff: 12 * EMU, nativeRow: r0, nativeRowOff: Math.round(rowOff) } as any,
    ext: { width: size, height: size },
    editAs: 'oneCell',
  });
};

const title = (ws: ExcelJS.Worksheet, range: string, text: string, brandRange?: string) => {
  if (!BRAND) {
    ws.mergeCells(range);
    put(ws, range.split(':')[0], text, { font: f({ size: 15, bold: true }), align: { horizontal: 'center', vertical: 'middle' } });
    return;
  }
  const r = brandRange ?? range;
  ws.mergeCells(r);
  // Leading spaces give real left padding in every viewer (Google Sheets ignores cell indent)
  // and leave room for the logo where it displays.
  put(ws, r.split(':')[0], '\u00A0'.repeat(10) + text, {
    font: f({ size: 17, bold: true, color: { argb: BR.ink } }),
    align: { horizontal: 'left', vertical: 'middle' },
    fill: solid(BR.mist),
  });
  if ((ws.getRow(1).height ?? 0) < 24) ws.getRow(1).height = 24;
  if ((ws.getRow(2).height ?? 0) < 24) ws.getRow(2).height = 24;
  // The logo is placed once the tab's row heights are final (see placeMark).
  markStart.set(ws, Number(ws.getCell(r.split(':')[0]).col));
};

const instructions = (ws: ExcelJS.Worksheet, range: string, text: string, vertical?: 'middle') => {
  ws.mergeCells(range);
  put(ws, range.split(':')[0], text, {
    align: { wrapText: true, horizontal: 'left', vertical: BRAND ? 'top' : vertical },
    font: BRAND ? f({ color: { argb: BR.slate } }) : undefined,
  });
};

const greenWhenFilled = (ws: ExcelJS.Worksheet, ref: string, firstCell: string) => {
  if (BRAND) return; // the branded look uses source colors instead
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
  // Branded: no row-number column; column A is hidden so the tab starts with the table.
  if (BRAND) ws.getColumn(1).hidden = true;
  title(ws, 'C1:G2', `${ASSESSMENT.year} Assessment`, 'B1:I2');
  ws.getRow(1).height = 27;
  ws.getRow(2).height = 27;
  instructions(
    ws,
    BRAND ? 'B3:I3' : 'C3:I3',
    `${agentName}: these are all of your ${ASSESSMENT.year} transactions for both the Buyer Side and the Listing Side, with your GCI and agent net ` +
      'commission income, pulled from the Finance tab under Business Tracker. You can add more deals at the bottom of each chart if necessary, ' +
      'and the numbers below will update automatically.',
    'middle',
  );
  ws.getRow(3).height = BRAND ? 46 : 38.25;

  const headers = [
    'Client Name', 'Transaction Address', 'Closed Date', 'Closed Price', 'Commission %',
    'Source of Business', 'Gross Commission Income', 'Agent Net Commission Income',
  ];

  let r = 4;
  const table = (label: string, rows: Deal[], labelHeight: number) => {
    put(ws, [r, BRAND ? 2 : 3], label, { font: f({ bold: true }), align: { vertical: 'middle' }, role: 'section' });
    ws.getRow(r).height = BRAND ? 34 : labelHeight;
    const numericCol = [false, false, true, true, true, false, true, true]; // matches each column's data
    headers.forEach((h, i) =>
      put(ws, [r + 1, 2 + i], h, {
        font: f({ bold: true }),
        border: true,
        role: 'header',
        align: BRAND ? { horizontal: numericCol[i] ? 'right' : 'left' } : undefined,
      }),
    );
    if (BRAND) ws.getRow(r + 1).height = 30;
    const first = r + 2;
    const count = Math.max(MIN_TABLE_ROWS, rows.length + SPARE_ROWS);
    for (let i = 0; i < count; i++) {
      const rowNum = first + i;
      const d = rows[i];
      const src = d ? sourceByKey(d.source) : undefined;
      const pct = d ? toNumber(d.commissionPct) : null;
      const net = d ? toNumber(d.netIncome) : null;
      if (!BRAND) put(ws, [rowNum, 1], formula(`IF(C${rowNum}="","",COUNTA(C$${first}:C${rowNum}))`), { font: f({ bold: i === 0 }) });
      put(ws, [rowNum, 2], d ? d.clientName.trim() : undefined, { border: true });
      put(ws, [rowNum, 3], d ? d.address + (d.fromDual ? ' (dual)' : '') : undefined, { border: true });
      put(ws, [rowNum, 4], d ? toExcelDate(d.closeDate) : undefined, { border: true, fmt: DATE });
      put(ws, [rowNum, 5], d ? d.price : undefined, { border: true, fmt: CURRENCY });
      put(ws, [rowNum, 6], pct !== null ? pct / 100 : undefined, { border: true, fmt: PCT });
      const g = put(ws, [rowNum, 7], src ? src.label : undefined, { border: true });
      g.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${SOURCE_OF_BUSINESS_LIST.join(',')}"`] };
      put(ws, [rowNum, 8], formula(`E${rowNum}*F${rowNum}`), { border: true, fmt: BRAND ? CURRENCY_HIDE_ZERO : CURRENCY });
      put(ws, [rowNum, 9], net !== null ? net : undefined, { border: true, fmt: CURRENCY });
    }
    const last = first + count - 1;
    greenWhenFilled(ws, `E${first}:E${last}`, `E${first}`);
    if (BRAND) {
      // Each Source of Business cell takes on that source's color, including ones picked later from the dropdown.
      ws.addConditionalFormatting({
        ref: `G${first}:G${last}`,
        rules: SOURCE_OF_BUSINESS_LIST.map((src, k) => ({
          type: 'expression' as const,
          priority: k + 1,
          formulae: [`$G${first}="${src}"`],
          style: {
            fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: SOURCE_TINT[src] }, fgColor: { argb: SOURCE_TINT[src] } },
          },
        })),
      });
    }
    r = last + 1;
    return { first, last };
  };

  const buyer = table('Buyer Side', deals.filter((d) => d.side === 'Buyer'), 27);
  const listing = table('Listing Side', deals.filter((d) => d.side === 'Listing'), 29.25);

  // Summary block: two blank rows, then the column headers (template rows 30-35).
  r += 2;
  ws.getRow(r).height = 20.25;
  ['Buyer Side', 'Listing Side', 'TOTAL'].forEach((h, i) =>
    put(ws, [r, 5 + i], h, { font: f({ bold: true }), align: { horizontal: BRAND ? 'right' : 'center', vertical: 'middle' }, role: 'header' }),
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
    put(ws, [rowNum, 3], label, { font: f({ bold: true }), role: 'label' });
    if (BRAND) put(ws, [rowNum, 4], undefined, { role: 'label' });
    put(ws, [rowNum, 5], formula(e), { fmt, role: 'cell' });
    put(ws, [rowNum, 6], formula(fm), { fmt, role: 'cell' });
    put(ws, [rowNum, 7], formula(g.replace(/\{r\}/g, String(rowNum))), { font: f({ italic: true, bold: boldTotal }), fmt, role: 'total' });
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
  put(ws, [start, 1], o.label, { font: f({ size: 12, bold: true }), role: 'section' });
  if (BRAND) {
    ws.getRow(start).height = 30; // room above the section title
    ws.getRow(start + 1).height = 20; // column labels right under it
  }
  if (BRAND) put(ws, [start + 1, 1], undefined, { role: 'sub' });
  put(ws, [start + 1, 2], 'Number of Sales', { align: { horizontal: 'right' }, role: 'sub' });
  put(ws, [start + 1, 3], 'Percentage', { align: { horizontal: 'right' }, role: 'sub' });
  if (o.extra) put(ws, [start + 1, 4], o.extra.header, { align: { horizontal: 'right' }, role: 'sub' });
  const first = start + 2;
  const totalRow = first + o.labels.length;
  o.labels.forEach((l, i) => {
    const rowNum = first + i;
    const isLast = i === o.labels.length - 1;
    const isOtherName = l.startsWith('Other (name');
    const nameIt = !o.labelValue && isOtherName;
    // Total Sales "Other" rows repeat the names typed above: plain white cells, text kept left.
    const echoed = !!o.labelValue && isOtherName;
    put(ws, [rowNum, 1], o.labelValue ? o.labelValue(i) : l, {
      ...(isLast || echoed ? { align: { horizontal: 'left' as const } } : {}),
      ...(nameIt ? { role: 'input' as const } : echoed ? { role: 'cell' as const } : { tint: tintFor(l) }),
    });
    const v = o.values(i, rowNum);
    put(ws, [rowNum, 2], v, {
      role: v === undefined ? 'input' : 'cell',
      ...(v === undefined ? { align: { horizontal: 'right' as const } } : {}),
    });
    put(ws, [rowNum, 3], formula(`IFERROR(B${rowNum}/B$${totalRow},0)`), {
      font: BRAND ? f() : { name: '"Google Sans"', size: 10, color: { argb: 'FF1F1F1F' } },
      align: { horizontal: 'right' },
      fmt: PCT,
      role: 'cell',
    });
    if (o.extra) put(ws, [rowNum, 4], o.extra.value(i), { fmt: o.extra.fmt, role: 'cell' });
  });
  put(ws, [totalRow, 1], o.totalLabel, { font: o.totalLabelFont, role: 'total' });
  put(ws, [totalRow, 2], formula(`SUM(B${first}:B${totalRow - 1})`), { font: f({ bold: true, italic: true }), role: 'total' });
  put(ws, [totalRow, 3], formula(`SUM(C${first}:C${totalRow - 1})`), { font: f({ bold: true, italic: true }), fmt: PCT, role: 'total' });
  if (o.extra) put(ws, [totalRow, 4], formula(`SUM(D${first}:D${totalRow - 1})`), { font: f({ bold: true, italic: true }), fmt: o.extra.fmt, role: 'total' });
  if (BRAND) ws.getRow(totalRow + 1).height = 26; // clear break before the next section
  return { first, totalRow, next: totalRow + 2 };
};

// ---------------------------------------------------------------
// Tab 2: Sources of business for the assessment year (automatic)
// ---------------------------------------------------------------
const buildSources = (wb: ExcelJS.Workbook, a: AssessmentRefs) => {
  const ws = sheet(wb, `My Sources of Business ${ASSESSMENT.year}`, [36.9, 20.9, 21.2, 20.9]);
  title(ws, 'A1:C2', `My Sources of Business for ${ASSESSMENT.year}`, 'A1:D2');
  instructions(
    ws,
    'A3:C3',
    `These numbers fill in automatically from your ${ASSESSMENT.year} Assessment tab. If you change a deal's Source of Business there, this page updates.`,
  );
  ws.getRow(3).height = BRAND ? 46 : 27;

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
    'Instructions: fill up the annual Expense Amount ($) for each of these categories at the best of your knowledge. This will help us budget for the new year!' +
      (BRAND ? ' Light blue cells are yours to fill in.' : ''),
  );
  ws.getRow(3).height = BRAND ? 44 : 40;
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
    if (BRAND) {
      // Section heading, matching the group names on the app's Expenses screen.
      if (gi > 0) r++; // blank row after the previous group's total
      put(ws, [r, 1], EXPENSE_GROUPS[gi].title, { role: 'section' });
      ws.getRow(r).height = 30;
      r++;
    }
    const first = r;
    for (const [label, entry] of items) {
      const isOther = label === 'Other Expenses';
      put(ws, [r, 1], BRAND && isOther ? 'Other expense (name it)' : label, {
        align: { wrapText: !BRAND }, // branded: one line, column widens to fit
        role: isOther ? 'input' : 'label',
        font: BRAND && isOther ? f({ color: { argb: BR.slate } }) : undefined,
      });
      const amt = amountOf(entry);
      put(ws, [r, 2], amt !== null ? amt : undefined, { fmt: CURRENCY, role: 'input', align: { horizontal: 'right' } });
      r++;
    }
    const lastGroup = gi === groups.length - 1;
    const bottom: Partial<ExcelJS.Borders> | undefined = lastGroup ? undefined : { bottom: thin };
    const a = put(ws, [r, 1], totalLabel, { font: f({ bold: true, italic: true }), align: { wrapText: !BRAND }, role: 'total' });
    const b = put(ws, [r, 2], formula(`SUM(B${first}:B${r - 1})`), { font: f({ italic: true }), fmt: CURRENCY, role: 'total' });
    if (bottom && !BRAND) {
      a.border = bottom;
      b.border = bottom;
    }
    totals.push(r);
    r++;
  });
  ws.getRow(r).height = 12.75;
  r++;
  ws.getRow(r).height = 30;
  put(ws, [r, 1], 'TOTAL', { font: f({ bold: true }), align: { horizontal: 'right', vertical: 'middle' }, role: 'grand' });
  put(ws, [r, 2], formula(totals.map((t) => `B${t}`).join('+')), {
    font: f({ bold: true, italic: true }),
    align: { vertical: 'middle' },
    fmt: CURRENCY,
    role: 'grand',
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
    `Instructions: Make sure to indicate the amount of transactions you would like to achieve on each side of the transaction and what is the average price per the assessment you made for the year ${ASSESSMENT.year}. All the numbers should autopopulate once you add these two numbers in the appropriate fields.` +
      (BRAND ? ' Light blue cells are yours to fill in.' : ''),
  );
  ws.getRow(4).height = 20.25;
  if (BRAND) ws.getRow(3).height = 32; // DM Sans runs taller than Arial

  if (BRAND) put(ws, 'A6', undefined, { role: 'header' });
  if (BRAND) put(ws, 'B6', undefined, { role: 'header' });
  put(ws, 'C6', 'Buyer Side', { role: 'header', align: BRAND ? { horizontal: 'right' } : undefined });
  put(ws, 'D6', 'Listing Side', { role: 'header', align: BRAND ? { horizontal: 'right' } : undefined });
  put(ws, 'E6', 'Total', { font: f({ italic: true }), align: { horizontal: 'right' }, role: 'header' });
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
    put(ws, [r, 1], label, { font: f({ bold: true }), role: 'label' });
    if (BRAND) put(ws, [r, 2], undefined, { role: 'label' });
    // Rows the agent types into (Total Sales Volume calculates from the two above it).
    const typed = i !== 2;
    put(ws, [r, 3], c ? formula(c) : undefined, { fmt, role: typed ? 'input' : 'cell', align: { horizontal: 'right' } });
    put(ws, [r, 4], d ? formula(d) : undefined, { fmt, role: typed ? 'input' : 'cell', align: { horizontal: 'right' } });
    put(ws, [r, 5], formula(e), { font: f({ italic: true, bold: boldTotal }), fmt, role: 'total' });
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
    labelValue: (i) =>
      i >= SHEET_SOURCES.length ? { formula: `A${buyer.first + i}`, result: labels[i] } : labels[i],
  });
};


// ---------------------------------------------------------------
// Column auto-fit: widen each column to fit its longest text plus padding.
// Widths are in Excel units (about one "0" character each). Never narrower
// than the template's width. Wrapped cells only need their longest word;
// merged cells (titles, instructions) are skipped; calculated cells are
// sized for the largest amount they could show.
// ---------------------------------------------------------------
const charUnits = (ch: string) => {
  if (ch === ' ') return 0.5;
  if (/[il.,:;'|!]/.test(ch)) return 0.45;
  if (/[fjrt()\-\/]/.test(ch)) return 0.6;
  if (/[mwMW@%&]/.test(ch)) return 1.45;
  if (/[A-Z]/.test(ch)) return 1.2;
  if (/[0-9$]/.test(ch)) return 1.0;
  return 1.0;
};
const textUnits = (text: string, font?: Partial<ExcelJS.Font>) => {
  let u = 0;
  for (const ch of text) u += charUnits(ch);
  const size = (font?.size ?? 10) / 10;
  return u * size * (font?.bold ? 1.08 : 1);
};
const fmtMoney = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const autoFit = (ws: ExcelJS.Worksheet, bigMoney: string) => {
  const merged = new Set<string>();
  // ExcelJS keeps merges on the worksheet model as "A1:B2" ranges.
  for (const range of ((ws as any).model?.merges ?? []) as string[]) {
    const [a, b] = range.split(':');
    const s = ws.getCell(a), e = ws.getCell(b);
    for (let r = Number(s.row); r <= Number(e.row); r++)
      for (let c = Number(s.col); c <= Number(e.col); c++) merged.add(`${r}:${c}`);
  }
  const need: Record<number, number> = {};
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (merged.has(`${cell.row}:${cell.col}`)) return;
      const v: any = cell.value;
      if (v === null || v === undefined || v === '') return;
      let text: string;
      if (typeof v === 'object' && v && 'formula' in v) {
        const fmt = cell.numFmt || '';
        text = fmt.includes('$') ? bigMoney : fmt.includes('%') ? '100.00%' : '99';
      } else if (v instanceof Date) {
        text = '00/00/0000';
      } else if (typeof v === 'number') {
        const fmt = cell.numFmt || '';
        text = fmt.includes('$') ? fmtMoney(v) : fmt.includes('%') ? (v * 100).toFixed(2) + '%' : String(v);
      } else {
        text = String(v);
      }
      const wrap = !!cell.alignment?.wrapText;
      const piece = wrap ? text.split(/\s+/).reduce((a, w) => (w.length > a.length ? w : a), '') : text;
      const indent = (cell.alignment?.indent ?? 0) * 1.2;
      const units = textUnits(piece, cell.font) * 1.08 + indent + 3.5; // + cell padding, with room for a wider fallback font
      const col = Number(cell.col);
      need[col] = Math.max(need[col] ?? 0, units);
    });
  });
  for (const [c, u] of Object.entries(need)) {
    const col = ws.getColumn(Number(c));
    col.width = Math.max(col.width ?? 8.43, Math.ceil(u * 10) / 10);
  }
};

export const buildWorkbook = async (
  allDeals: Deal[],
  agent: { name: string; email: string },
  expenses: Expenses = {},
  options: { branded?: boolean } = {},
): Promise<ArrayBuffer> => {
  const deals = allDeals.filter((d) => !d.excluded).sort((x, y) => x.closeDate.localeCompare(y.closeDate));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Compass Business Planning Series';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  BRAND = !!options.branded;
  MARK_ID = BRAND ? wb.addImage({ base64: MARK_PNG_BASE64, extension: 'png' }) : null;

  const a = buildAssessment(wb, deals, agent.name);
  buildSources(wb, a);
  buildExpenses(wb, expenses);
  buildGoals(wb, a);
  buildSourceGoals(wb);

  if (BRAND) {
    // Gridlines off (tables carry their own light borders) and colored tabs.
    const tabColors = ['FF9DBFE8', 'FF9FD5BD', 'FFF3D493', 'FFC2B3EC', 'FFF0B3AE'];
    // Size money columns for the largest total this workbook could show.
    const volume = deals.reduce((t, d) => t + (d.price || 0), 0);
    const bigMoney = fmtMoney(Math.max(volume, 1_000_000));
    wb.worksheets.forEach((ws, i) => {
      autoFit(ws, bigMoney);
      placeMark(ws);
      ws.views = [{ showGridLines: false }];
      ws.properties.tabColor = { argb: tabColors[i] ?? BR.ink };
    });
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
};
