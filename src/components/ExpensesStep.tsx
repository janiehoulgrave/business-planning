import React, { useState } from 'react';
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { ASSESSMENT } from '../config';
import {
  amountOf,
  EXPENSE_GROUPS,
  ExpenseEntry,
  Expenses,
  expensesTotal,
  groupTotal,
  itemKey,
  otherKey,
} from '../lib/expenses';
import { money } from '../lib/types';

const dollars = (n: number) => money(n, n % 1 ? 2 : 0);
import { Button, Panel } from './ui';

interface Props {
  expenses: Expenses;
  onChange: (e: Expenses) => void;
  onBack: () => void;
  onBuild: () => void;
  building: boolean;
}

const fieldClass =
  'h-11 rounded-lg border border-line bg-paper text-[16px] outline-none transition-colors focus:border-blue focus:ring-2 focus:ring-blue/15';

// Dollar field: shows "1,250" at rest, the plain number while editing.
const MoneyInput: React.FC<{ id: string; label: string; value: string; onChange: (v: string) => void }> = ({
  id,
  label,
  value,
  onChange,
}) => {
  const [editing, setEditing] = useState(false);
  const n = amountOf({ amount: value });
  const shown = editing || n === null ? value : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return (
    <div className="relative w-36 shrink-0">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none">$</span>
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        className={`${fieldClass} w-full pl-7 pr-3 text-right tabular-nums`}
        value={shown}
        placeholder="0"
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
      />
    </div>
  );
};

export const ExpensesStep: React.FC<Props> = ({ expenses, onChange, onBack, onBuild, building }) => {
  const set = (key: string, patch: Partial<ExpenseEntry>) =>
    onChange({ ...expenses, [key]: { ...(expenses[key] ?? { amount: '' }), ...patch } });
  const total = expensesTotal(expenses);

  return (
    <div className="step-in max-w-5xl mx-auto px-5 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.015em] leading-tight">Your {ASSESSMENT.year} expenses</h1>
      <p className="mt-3 text-[17px] text-slate max-w-[62ch]">
        Enter the annual amount for each category, to the best of your knowledge. This helps you budget for the new year. Leave
        anything that doesn't apply blank.
      </p>

      <div className="mt-10 grid lg:grid-cols-2 gap-6 items-start">
        {EXPENSE_GROUPS.map((g) => (
          <Panel key={g.key} className="overflow-hidden">
            <h2 className="px-5 md:px-6 pt-5 pb-3 text-[18px] font-bold">{g.title}</h2>
            <div className="divide-y divide-line">
              {g.items.map((label, i) => {
                const key = itemKey(g.key, i);
                return (
                  <div key={key} className="flex items-center justify-between gap-4 px-5 md:px-6 py-2.5">
                    <label htmlFor={`exp-${key}`} className="text-[15px] min-w-0">
                      {label}
                    </label>
                    <MoneyInput
                      id={`exp-${key}`}
                      label={label}
                      value={expenses[key]?.amount ?? ''}
                      onChange={(v) => set(key, { amount: v })}
                    />
                  </div>
                );
              })}
              {Array.from({ length: g.others }, (_, i) => {
                const key = otherKey(g.key, i);
                return (
                  <div key={key} className="flex items-center justify-between gap-4 px-5 md:px-6 py-2.5">
                    <input
                      id={`exp-${key}-name`}
                      aria-label={`Other ${g.title.toLowerCase()} expense ${i + 1}, name`}
                      autoComplete="off"
                      className={`${fieldClass} min-w-0 flex-1 px-3 text-[15px]`}
                      placeholder="Other expense (name it)"
                      value={expenses[key]?.name ?? ''}
                      onChange={(e) => set(key, { name: e.target.value })}
                    />
                    <MoneyInput
                      id={`exp-${key}`}
                      label={`Other ${g.title.toLowerCase()} expense ${i + 1}, amount`}
                      value={expenses[key]?.amount ?? ''}
                      onChange={(v) => set(key, { amount: v })}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-4 px-5 md:px-6 py-3.5 bg-[#f7f9fb] border-t border-line">
              <span className="text-[15px] font-medium">{g.title} total</span>
              <span className="text-[16px] font-bold tabular-nums">{dollars(groupTotal(expenses, g))}</span>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-10 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="quiet" onClick={onBack}>
          <ArrowLeft size={16} /> Back to your deals
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <p className="text-[16px]">
            Total expenses <span className="font-bold tabular-nums ml-1">{dollars(total)}</span>
          </p>
          <Button size="lg" onClick={onBuild} disabled={building}>
            {building ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
            {building ? 'Building your workbook' : 'Build my workbook'}
          </Button>
        </div>
      </div>
    </div>
  );
};
