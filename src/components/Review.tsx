import React from 'react';
import { AlertCircle, ArrowRight, Plus } from 'lucide-react';
import { ASSESSMENT, SOURCES, sourceByKey } from '../config';
import { Deal, gci, missingFields, money, shortDate } from '../lib/types';
import { DealStrip } from './DealStrip';
import { Button, Panel } from './ui';

interface Props {
  deals: Deal[];
  onEdit: (i: number) => void;
  onAddFiles: () => void;
  onBuild: () => void;
  onSkipExpenses: () => void;
  building: boolean;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : money(n);

export const Review: React.FC<Props> = ({ deals, onEdit, onAddFiles, onBuild, onSkipExpenses, building }) => {
  const included = deals.filter((d) => !d.excluded);
  const incomplete = included.filter((d) => missingFields(d).length > 0);
  const volume = included.reduce((s, d) => s + d.price, 0);
  const totalGci = included.reduce((s, d) => s + (gci(d) ?? 0), 0);

  const groups: { side: 'Buyer' | 'Listing'; title: string }[] = [
    { side: 'Buyer', title: 'Buyer side' },
    { side: 'Listing', title: 'Listing side' },
  ];

  return (
    <div className="step-in max-w-5xl mx-auto px-5 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.015em] leading-tight">Your {ASSESSMENT.year} at a glance</h1>
      <p className="mt-3 text-[18px] text-slate max-w-[62ch]">
        {included.length} {included.length === 1 ? 'deal side' : 'deal sides'}, {compact(volume)} in sales volume
        {totalGci > 0 ? `, ${compact(totalGci)} in gross commission` : ''}.
      </p>

      <Panel className="mt-8 p-6 md:p-7">
        <DealStrip deals={deals} onJump={onEdit} tall groupBySource />
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {SOURCES.map((s) => {
            const n = included.filter((d) => d.source === s.key).length;
            return (
              <li key={s.key} className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <span>{s.label}</span>
                <span className="text-slate">{n}</span>
              </li>
            );
          })}
          {included.some((d) => !d.source) && (
            <li className="inline-flex items-center gap-2 text-slate">
              <span className="w-2.5 h-2.5 rounded-full bg-line" />
              Not answered {included.filter((d) => !d.source).length}
            </li>
          )}
        </ul>
      </Panel>

      {incomplete.length > 0 && (
        <div className="mt-6 flex gap-3 items-start rounded-2xl bg-amber-tint border border-[#f1d3a8] px-5 py-4">
          <AlertCircle size={20} className="text-amber shrink-0 mt-0.5" />
          <p className="text-[15px] text-[#5c3a10]">
            {incomplete.length} {incomplete.length === 1 ? 'deal needs' : 'deals need'} a few more answers before you can build your
            workbook. They're marked below.
          </p>
        </div>
      )}

      {groups.map(({ side, title }) => {
        const rows = deals.map((d, i) => ({ d, i })).filter(({ d }) => d.side === side);
        if (!rows.length) return null;
        return (
          <section key={side} className="mt-10">
            <h2 className="text-[20px] font-bold mb-3">
              {title} <span className="text-slate font-normal">{rows.filter(({ d }) => !d.excluded).length}</span>
            </h2>
            <Panel className="divide-y divide-line overflow-hidden">
              {rows.map(({ d, i }) => {
                const missing = missingFields(d);
                const src = sourceByKey(d.source);
                return (
                  <div
                    key={d.id}
                    className={`grid md:grid-cols-[1.5fr_1fr_1.2fr_110px_88px] gap-x-5 gap-y-1.5 px-5 py-4 items-center ${
                      d.excluded ? 'opacity-50' : ''
                    } ${missing.length ? 'bg-[#fffaf2]' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className={`text-[16px] font-medium truncate ${d.excluded ? 'line-through' : ''}`}>{d.address}</div>
                      <div className="text-[13px] text-slate">
                        {shortDate(d.closeDate)}, {money(d.price)}
                        {d.fromDual ? ', dual' : ''}
                      </div>
                    </div>
                    <div className="text-[15px] truncate">
                      {d.excluded ? <span className="text-slate">Left out</span> : d.clientName || <span className="text-amber">Client needed</span>}
                    </div>
                    <div className="text-[15px] min-w-0">
                      {!d.excluded &&
                        (src ? (
                          <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: src.color }} />
                            <span className="truncate">
                              {src.label}
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber">Source needed</span>
                        ))}
                    </div>
                    <div className="text-[15px] md:text-right tabular-nums">
                      {!d.excluded && (gci(d) !== null ? money(gci(d)) : <span className="text-amber">Commission needed</span>)}
                    </div>
                    <div className="md:text-right">
                      <button onClick={() => onEdit(i)} className="text-[15px] font-medium underline underline-offset-4 decoration-line hover:decoration-ink">
                        {missing.length ? 'Finish' : 'Edit'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </Panel>
          </section>
        );
      })}

      <div className="mt-12 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="quiet" onClick={onAddFiles}>
          <Plus size={16} /> Add another file
        </Button>
        <div className="flex flex-col sm:items-end gap-2">
          <Button size="lg" onClick={onBuild} disabled={incomplete.length > 0 || included.length === 0 || building}>
            Next: your expenses <ArrowRight size={18} />
          </Button>
          {incomplete.length > 0 ? (
            <p className="text-[13px] text-slate">Finish the marked deals to continue.</p>
          ) : (
            <button
              type="button"
              onClick={onSkipExpenses}
              disabled={included.length === 0 || building}
              className="text-[14px] text-slate underline underline-offset-4 decoration-line hover:text-ink disabled:opacity-50"
            >
              {building ? 'Building your workbook' : 'Skip expenses and build my workbook'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
