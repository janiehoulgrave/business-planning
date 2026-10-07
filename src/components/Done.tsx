import React from 'react';
import { Download, FileSpreadsheet, Loader2, PencilLine } from 'lucide-react';
import { ASSESSMENT, GOAL_YEAR } from '../config';
import { Deal } from '../lib/types';
import { DealStrip } from './DealStrip';
import { Button, Panel } from './ui';
import { ConfirmButton } from './ConfirmButton';

export type EmailStatus = 'sent' | 'failed' | 'off' | 'earlier';

interface Props {
  email: string;
  deals: Deal[];
  emailStatus: EmailStatus;
  submittedAt?: string | null;
  onDownload: () => void;
  onOpenSheets: () => void;
  sheetUrl: string | null;
  sheetsBusy: boolean;
  onEdit: () => void;
  onStartOver: () => void;
}

export const Done: React.FC<Props> = ({ deals, onDownload, onOpenSheets, sheetUrl, sheetsBusy, onEdit, onStartOver }) => {
  return (
    <div className="step-in max-w-2xl mx-auto px-5 py-12 md:py-16">
      <h1 className="text-[34px] md:text-[44px] font-bold tracking-[-0.02em] leading-[1.08]">Your workbook is ready.</h1>
      <p className="mt-4 text-[18px] text-slate leading-relaxed">
        It has your {ASSESSMENT.year} assessment, sources of business, and expenses filled in, plus {GOAL_YEAR} goal pages you'll work
        on in the next session. Bring it to the marketing strategy workshop too.
      </p>

      <Panel className="mt-8 p-6 md:p-7">
        <DealStrip deals={deals} groupBySource />
        <div className="mt-6 flex flex-col gap-3">
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 font-medium rounded-full h-14 px-8 text-[17px] bg-ink text-paper hover:bg-[#2a2f36]"
            >
              <FileSpreadsheet size={18} /> Open in Google Sheets
            </a>
          ) : (
            <Button size="lg" onClick={onOpenSheets} disabled={sheetsBusy}>
              {sheetsBusy ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
              {sheetsBusy ? 'Creating your Google Sheet' : 'Open in Google Sheets'}
            </Button>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" variant="secondary" onClick={onDownload} className="sm:flex-1">
              <Download size={18} /> Download .xlsx
            </Button>
            <Button size="lg" variant="secondary" onClick={onEdit} className="sm:flex-1">
              <PencilLine size={18} /> Make changes
            </Button>
          </div>
          <p className="text-[14px] text-slate">
            {sheetUrl
              ? 'Saved to your Google Drive. Changes you make there stay in your copy.'
              : 'Your answers are saved, so you can come back to this page any time to open or download your workbook again.'}
          </p>
        </div>
      </Panel>

      <ConfirmButton
        onConfirm={onStartOver}
        confirmLabel="Click again to clear your deals and answers"
        className="mt-10 text-[14px] text-slate underline underline-offset-4 decoration-line hover:text-ink"
      >
        Start over with a new file
      </ConfirmButton>
    </div>
  );
};
