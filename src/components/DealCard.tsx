import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, EyeOff, Undo2 } from 'lucide-react';
import { SOURCES, sourceByKey } from '../config';
import { Deal, gci, missingFields, money, shortDate, Side, toNumber } from '../lib/types';
import { DealStrip } from './DealStrip';
import { Button, inputClass, Label, Panel } from './ui';

interface Props {
  deals: Deal[];
  index: number;
  onUpdate: (d: Deal) => void;
  onNext: () => void;
  onPrev: () => void;
  onJump: (i: number) => void;
  returnToReview: boolean;
}

const roundPct = (n: number) => String(Math.round(n * 1000) / 1000);

export const DealCard: React.FC<Props> = ({ deals, index, onUpdate, onNext, onPrev, onJump, returnToReview }) => {
  const deal = deals[index];
  const set = (patch: Partial<Deal>) => onUpdate({ ...deal, ...patch });
  const src = sourceByKey(deal.source);
  const missing = missingFields(deal);
  const nameRef = useRef<HTMLInputElement>(null);

  // GCI and commission % are linked: typing either fills in the other.
  const [gciText, setGciText] = useState('');
  useEffect(() => {
    const g = gci(deal);
    setGciText(g === null ? '' : String(g));
    if (!deal.clientName) nameRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    deals.forEach((d) => {
      if (d.id !== deal.id && d.source === deal.source && d.sourceDetail.trim()) seen.add(d.sourceDetail.trim());
    });
    return [...seen].sort();
  }, [deals, deal.id, deal.source]);

  const answered = deals.filter((d) => d.excluded || missingFields(d).length === 0).length;

  return (
    <div className="step-in max-w-3xl mx-auto px-5 py-8 md:py-10">
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-3 text-[14px] text-slate">
          <span>
            Deal <span className="text-ink font-medium">{index + 1}</span> of {deals.length}
          </span>
          <span>{answered} complete</span>
        </div>
        <DealStrip deals={deals} current={index} onJump={onJump} />
      </div>

      <Panel className={`overflow-hidden ${deal.excluded ? 'opacity-70' : ''}`}>
        <div className="px-6 md:px-8 pt-6 md:pt-7 pb-6 border-b border-line">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-slate">
            <div className="inline-flex rounded-full bg-mist p-0.5" role="radiogroup" aria-label="Side">
              {(['Buyer', 'Listing'] as Side[]).map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={deal.side === s}
                  onClick={() => set({ side: s })}
                  className={`px-3 h-7 rounded-full text-[13px] font-medium transition-colors ${
                    deal.side === s ? 'bg-ink text-paper' : 'text-slate hover:text-ink'
                  }`}
                >
                  {s} side
                </button>
              ))}
            </div>
            <span>Closed {shortDate(deal.closeDate)}</span>
            <span>{money(deal.price)}</span>
          </div>
          <h1 className={`mt-4 text-[26px] md:text-[32px] font-bold leading-tight tracking-[-0.01em] ${deal.excluded ? 'line-through' : ''}`}>
            {deal.address}
          </h1>
          {deal.fromDual && (
            <p className="mt-2 text-[15px] text-slate">
              Dual deal. This is the {deal.side.toLowerCase()} side; you'll answer for the other client separately.
            </p>
          )}
        </div>

        {deal.excluded ? (
          <div className="px-6 md:px-8 py-10">
            <p className="text-[17px]">This deal is left out of your workbook.</p>
            <Button variant="secondary" className="mt-5" onClick={() => set({ excluded: false })}>
              <Undo2 size={16} /> Include it again
            </Button>
          </div>
        ) : (
          <div className="px-6 md:px-8 py-7 space-y-9">
            <div>
              <Label htmlFor="client">
                {deal.side === 'Buyer' ? 'Who was the buyer?' : 'Who was the seller?'}
              </Label>
              <input
                id="client"
                ref={nameRef}
                className={inputClass}
                value={deal.clientName}
                placeholder="Client name"
                onChange={(e) => set({ clientName: e.target.value })}
                autoComplete="off"
              />
            </div>

            <fieldset>
              <legend className="text-[15px] font-medium mb-3">How did this client find you?</legend>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {SOURCES.map((s) => {
                  const on = deal.source === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ source: s.key, sourceDetail: on ? deal.sourceDetail : '' })}
                      className={`text-left rounded-xl border px-4 py-3.5 transition-colors grid grid-cols-[14px_1fr] gap-3 ${
                        on ? 'border-ink ring-1 ring-ink bg-blue-tint' : 'border-line bg-paper hover:border-[#9aa4af]'
                      }`}
                    >
                      <span
                        className="mt-[5px] w-3.5 h-3.5 rounded-full grid place-items-center"
                        style={{ background: s.color }}
                      >
                        {on && <Check size={10} strokeWidth={4} color="#1b2430" />}
                      </span>
                      <span>
                        <span className="block text-[16px] font-medium">{s.label}</span>
                        <span className="block text-[13px] text-slate leading-snug mt-0.5">{s.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {src?.detailPrompt && (
              <div className="step-in">
                <Label htmlFor="detail" hint={src.detailRequired ? undefined : 'Optional'}>
                  {src.detailPrompt}
                </Label>
                <input
                  id="detail"
                  className={inputClass}
                  value={deal.sourceDetail}
                  placeholder={src.detailPlaceholder}
                  list="detail-suggestions"
                  onChange={(e) => set({ sourceDetail: e.target.value })}
                  autoComplete="off"
                />
                <datalist id="detail-suggestions">
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                {suggestions.length > 0 && (
                  <p className="mt-2 text-[13px] text-slate">Start typing to reuse a name you've entered before, so it's spelled the same way.</p>
                )}
              </div>
            )}

            <div>
              <p className="text-[15px] font-medium">Your commission on this side</p>
              <p className="text-[13px] text-slate mt-0.5 mb-3">
                Filled in from your export. Change anything that looks off; % and GCI update each other.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pct" className="block text-[13px] text-slate mb-1.5">Commission %</label>
                  <div className="relative">
                    <input
                      id="pct"
                      inputMode="decimal"
                      className={`${inputClass} pr-9`}
                      value={deal.commissionPct}
                      placeholder="2.5"
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, '');
                        set({ commissionPct: v });
                        const n = toNumber(v);
                        setGciText(n === null ? '' : String(Math.round(deal.price * n) / 100));
                      }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate">%</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="gci" className="block text-[13px] text-slate mb-1.5">Gross commission (GCI)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate">$</span>
                    <input
                      id="gci"
                      inputMode="decimal"
                      className={`${inputClass} pl-8`}
                      value={gciText}
                      placeholder="0"
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, '');
                        setGciText(v);
                        const n = toNumber(v);
                        set({ commissionPct: n === null || !deal.price ? '' : roundPct((n / deal.price) * 100) });
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="net" className="block text-[13px] text-slate mb-1.5">Agent net income</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate">$</span>
                    <input
                      id="net"
                      inputMode="decimal"
                      className={`${inputClass} pl-8`}
                      value={deal.netIncome}
                      placeholder="0"
                      onChange={(e) => set({ netIncome: e.target.value.replace(/[^0-9.]/g, '') })}
                    />
                  </div>
                </div>
              </div>
              {(toNumber(deal.commissionPct) ?? 0) > 10 && (
                <p className="mt-2 text-[13px] text-amber">That's over 10%. Double-check the commission % for this side.</p>
              )}
            </div>
          </div>
        )}

        <div className="px-6 md:px-8 py-5 bg-[#f7f9fb] border-t border-line flex flex-wrap items-center gap-2">
          <Button onClick={onNext} disabled={!returnToReview && missing.length > 0} className="w-full sm:w-auto sm:order-last">
            {returnToReview ? 'Save and return' : index === deals.length - 1 ? 'Review all deals' : 'Next deal'}
            <ArrowRight size={16} />
          </Button>
          <Button variant="quiet" onClick={onPrev} disabled={!returnToReview && index === 0} className="sm:order-first sm:mr-auto">
            <ArrowLeft size={16} /> {returnToReview ? 'Back to review' : 'Previous'}
          </Button>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {!deal.excluded && (
              <Button variant="quiet" onClick={() => set({ excluded: true })} title="Not your deal, or it shouldn't count">
                <EyeOff size={16} /> Leave out
              </Button>
            )}
            {missing.length > 0 && !returnToReview ? (
              <Button variant="secondary" onClick={onNext}>
                Skip for now
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {missing.length > 0 && !deal.excluded && (
        <p className="mt-4 text-[14px] text-slate">Still needed: {missing.join(', ').toLowerCase()}.</p>
      )}
    </div>
  );
};
