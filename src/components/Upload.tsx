import React, { useRef, useState } from 'react';
import { ArrowRight, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { ASSESSMENT } from '../config';
import { dedupe, parseCompassCsv, sortDeals } from '../lib/csv';
import { Deal } from '../lib/types';
import { Button } from './ui';
import { ConfirmButton } from './ConfirmButton';
import { SAMPLE_CSV } from '../lib/sample';

interface Props {
  deals: Deal[];
  fileNames: string[];
  onChange: (deals: Deal[], fileNames: string[]) => void;
  onNext: () => void;
}

export const Upload: React.FC<Props> = ({ deals, fileNames, onChange, onNext }) => {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);

  const handle = async (files: File[]) => {
    setError('');
    setBusy(true);
    let next = [...deals];
    const names = [...fileNames];
    let outside = 0;
    const unreadable: string[] = [];
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.csv')) {
        unreadable.push(f.name);
        continue;
      }
      try {
        const res = await parseCompassCsv(f);
        if (!res.found) {
          unreadable.push(f.name);
          continue;
        }
        outside += res.outOfRange;
        next = [...next, ...dedupe(next, res.deals)];
        if (!names.includes(f.name)) names.push(f.name);
      } catch {
        unreadable.push(f.name);
      }
    }
    setSkipped((s) => s + outside);
    if (unreadable.length) {
      setError(
        `We couldn't find deals in ${unreadable.join(', ')}. Upload the CSV downloaded from the Finance tab of your Business Tracker.`,
      );
    }
    onChange(sortDeals(next), names);
    setBusy(false);
  };

  const dualCount = deals.filter((d) => d.fromDual).length / 2;

  return (
    <div className="step-in max-w-3xl mx-auto px-5 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.015em] leading-tight">Upload your deals</h1>
      <p className="mt-3 text-[17px] text-slate">The CSV from the Finance tab of your Business Tracker. You can add more than one file.</p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) handle(Array.from(e.dataTransfer.files));
        }}
        className={`mt-8 rounded-2xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue bg-blue-tint' : 'border-[#b9c3ce] bg-paper hover:border-ink'
        }`}
      >
        <UploadCloud size={36} className="mx-auto text-ink" strokeWidth={1.5} />
        <p className="mt-4 text-[18px] font-medium">{busy ? 'Reading your file' : 'Drop your CSV here, or click to choose'}</p>
        <p className="mt-1 text-[14px] text-slate">.csv files only</p>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handle(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="mt-4 text-[15px] text-amber">{error}</p>}

      {import.meta.env.VITE_PREVIEW && fileNames.length === 0 && (
        <p className="mt-4 text-[14px] text-slate">
          Preview only:{' '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-ink"
            onClick={() => handle([new File([SAMPLE_CSV], 'sample-business-tracker.csv', { type: 'text/csv' })])}
          >
            load sample deals
          </button>{' '}
          to try the flow without a real export.
        </p>
      )}

      {fileNames.length > 0 && (
        <div className="mt-8">
          <ul className="space-y-2">
            {fileNames.map((n) => (
              <li key={n} className="flex items-center gap-3 bg-paper border border-line rounded-xl px-4 h-12 text-[15px]">
                <FileSpreadsheet size={18} className="text-green shrink-0" />
                <span className="truncate">{n}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 bg-paper border border-line rounded-2xl p-6">
            {deals.length > 0 ? (
              <>
                <p className="text-[20px] font-bold">
                  {deals.length} {deals.length === 1 ? 'deal side' : 'deal sides'} closed in {ASSESSMENT.year}
                </p>
                <ul className="mt-2 text-[15px] text-slate space-y-1">
                  <li>
                    {deals.filter((d) => d.side === 'Buyer').length} buyer side, {deals.filter((d) => d.side === 'Listing').length} listing side
                  </li>
                  {dualCount > 0 && (
                    <li>
                      {dualCount} dual {dualCount === 1 ? 'deal is' : 'deals are'} split into buyer and listing sides so each client gets
                      their own source
                    </li>
                  )}
                  {skipped > 0 && (
                    <li>
                      {skipped} {skipped === 1 ? 'deal' : 'deals'} outside {ASSESSMENT.year} left out
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <p className="text-[16px]">
                No deals in these files closed in {ASSESSMENT.year}. Check the date filter in your Business Tracker and download again.
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onNext} disabled={deals.length === 0}>
              Start with deal 1 <ArrowRight size={18} />
            </Button>
            <ConfirmButton
              className="inline-flex items-center gap-2 h-11 px-3 text-[15px] font-medium text-slate hover:text-ink"
              confirmLabel="Click again to remove files and answers"
              onConfirm={() => {
                setSkipped(0);
                onChange([], []);
              }}
            >
              <X size={16} /> Clear files
            </ConfirmButton>
          </div>
        </div>
      )}
    </div>
  );
};
