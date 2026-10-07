import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ASSESSMENT, SOURCES } from '../config';
import { Button, Panel } from './ui';
import { ConfirmButton } from './ConfirmButton';

const steps = [
  {
    title: 'Export your closed deals',
    body: (
      <>
        In your Compass Business Tracker, open the <strong className="font-medium text-ink">Finance</strong> tab, filter to
        deals that closed in {ASSESSMENT.year}, and download the CSV. If it splits into more than one file, download them all.
      </>
    ),
  },
  {
    title: 'Upload the file here',
    body: <>We read your deals and set aside anything that closed outside {ASSESSMENT.year}, so extra rows are fine.</>,
  },
  {
    title: 'Answer a few questions per deal',
    body: (
      <>
        Who the client was and how they found you. Price, GCI and your net commission come in from the export, so you
        only check them. You can skip a deal and come back to it.
      </>
    ),
  },
  {
    title: 'Add your expenses',
    body: <>Enter your annual business expenses by category. A best estimate is fine. These fill in the Expenses tab.</>,
  },
  {
    title: 'Get your workbook',
    body: <>Review everything on one page, then download your finished workbook. We also email you a copy for the next session.</>,
  },
];

interface Props {
  onNext: () => void;
  savedDeals?: number;
  onResume?: () => void;
  onStartOver?: () => void;
}

export const Instructions: React.FC<Props> = ({ onNext, savedDeals = 0, onResume, onStartOver }) => (
  <div className="step-in max-w-3xl mx-auto px-5 py-10 md:py-14">
    {savedDeals > 0 && onResume && onStartOver && (
      <Panel className="mb-10 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <p className="text-[16px]">
          Your {savedDeals} {savedDeals === 1 ? 'deal is' : 'deals are'} saved. Pick up where you left off, or start over with a new file.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <ConfirmButton
            className="h-11 px-3 text-[15px] font-medium text-slate hover:text-ink"
            confirmLabel="Click again to clear everything"
            onConfirm={onStartOver}
          >
            Start over
          </ConfirmButton>
          <Button onClick={onResume}>Continue</Button>
        </div>
      </Panel>
    )}
    <h1 className="text-[32px] md:text-[40px] font-bold tracking-[-0.015em] leading-tight">How this works</h1>
    <p className="mt-3 text-[17px] text-slate max-w-[60ch]">
      Five steps. Your answers save automatically, so you can close the tab and come back to finish.
    </p>

    <ol className="mt-10 space-y-7">
      {steps.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[40px_1fr] gap-4">
          <span className="w-10 h-10 rounded-full border border-ink grid place-items-center text-[15px] font-medium">{i + 1}</span>
          <div className="pt-1.5">
            <h2 className="text-[19px] font-bold">{s.title}</h2>
            <p className="mt-1.5 text-[16px] leading-relaxed text-slate max-w-[62ch]">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>

    <Panel className="mt-12 p-6 md:p-8">
      <h2 className="text-[19px] font-bold">The five sources of business</h2>
      <p className="mt-1.5 text-[15px] text-slate">You'll pick one for every client. Think about how you first met them.</p>
      <dl className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-5">
        {SOURCES.map((s) => (
          <div key={s.key} className="grid grid-cols-[12px_1fr] gap-3">
            <span className="mt-[7px] w-3 h-3 rounded-full" style={{ background: s.color }} />
            <div>
              <dt className="text-[16px] font-medium">{s.label}</dt>
              <dd className="text-[15px] text-slate leading-snug mt-0.5">{s.description}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Panel>

    <div className="mt-10">
      <Button size="lg" onClick={onNext}>
        Upload my deals <ArrowRight size={18} />
      </Button>
    </div>
  </div>
);
