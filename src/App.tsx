import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { WEBHOOK_URL } from './config';
import { Agent, cloudEnabled, forgetDriveToken, getDriveToken, clearProgress, loadProgress, saveProgress, SaveStatus, signOut, watchAgent } from './lib/store';
import { Deal, missingFields, SavedState, workbookFileName } from './lib/types';
import { saveFile } from './lib/download';
import { DriveError, uploadAsGoogleSheet } from './lib/drive';
import { TopBar } from './components/TopBar';
import { Welcome } from './components/Welcome';
import { Instructions } from './components/Instructions';
import { Upload } from './components/Upload';
import { DealCard } from './components/DealCard';
import { Review } from './components/Review';
import { Done, EmailStatus } from './components/Done';
import { ExpensesStep } from './components/ExpensesStep';

const EMPTY: SavedState = { deals: [], fileNames: [], step: 'instructions', index: 0, reachedReview: false, submittedAt: null };
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const webhookReady = !import.meta.env.VITE_PREVIEW && WEBHOOK_URL.startsWith('https://');


const App: React.FC = () => {
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined);
  const [state, setState] = useState<SavedState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [building, setBuilding] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('off');
  const [notice, setNotice] = useState('');
  const [sheetsBusy, setSheetsBusy] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => watchAgent(setAgent), []);

  // Load saved progress whenever someone signs in.
  useEffect(() => {
    if (!agent) {
      setLoaded(false);
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    loadProgress(agent).then((saved) => {
      if (cancelled) return;
      if (saved && saved.deals?.length) {
        setState({ ...EMPTY, ...saved });
        if (saved.step === 'done') setEmailStatus(webhookReady ? 'earlier' : 'off');
      } else setState(EMPTY);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [agent?.uid]);

  // Save shortly after every change.
  useEffect(() => {
    if (!agent || !loaded) return;
    window.clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = window.setTimeout(async () => {
      setSaveStatus(await saveProgress(agent, state));
    }, 700);
    return () => window.clearTimeout(saveTimer.current);
  }, [state, agent, loaded]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.step, state.index]);

  const patch = useCallback((p: Partial<SavedState>) => setState((s) => ({ ...s, ...p })), []);

  const updateDeal = (d: Deal) => setState((s) => ({ ...s, deals: s.deals.map((x) => (x.id === d.id ? d : x)) }));

  const next = () =>
    setState((s) => {
      if (s.reachedReview) return { ...s, step: 'review' };
      if (s.index < s.deals.length - 1) return { ...s, index: s.index + 1 };
      return { ...s, step: 'review', reachedReview: true };
    });

  const prev = () =>
    setState((s) => (s.reachedReview ? { ...s, step: 'review' } : { ...s, index: Math.max(0, s.index - 1) }));

  const makeWorkbook = async () => {
    const { buildWorkbook } = await import('./lib/workbook');
    return buildWorkbook(state.deals, { name: agent!.name, email: agent!.email }, state.expenses ?? {});
  };

  const build = async () => {
    if (!agent) return;
    setBuilding(true);
    try {
      const buf = await makeWorkbook();
      let status: EmailStatus = 'off';
      if (webhookReady) {
        try {
          const form = new FormData();
          form.append('file', new Blob([buf], { type: XLSX_TYPE }), workbookFileName(agent.name));
          form.append('agentName', agent.name);
          form.append('agentEmail', agent.email);
          form.append('dealCount', String(state.deals.filter((d) => !d.excluded).length));
          const res = await fetch(WEBHOOK_URL, { method: 'POST', body: form });
          status = res.ok ? 'sent' : 'failed';
        } catch {
          status = 'failed';
        }
      }
      setEmailStatus(status);
      patch({ step: 'done', submittedAt: new Date().toISOString(), sheetUrl: null });
    } catch (e) {
      console.error(e);
      setNotice('Something went wrong building the workbook. Your answers are saved; try again in a moment.');
    } finally {
      setBuilding(false);
    }
  };

  const download = async () => {
    if (!agent) return;
    setNotice('');
    const r = await saveFile(await makeWorkbook(), workbookFileName(agent.name));
    if (r === 'failed') setNotice('The download did not start. Try again in a moment.');
  };

  const openInSheets = async () => {
    if (!agent) return;
    setNotice('');
    if (state.sheetUrl) {
      window.open(state.sheetUrl, '_blank', 'noopener');
      return;
    }
    if (!cloudEnabled) {
      setNotice('Opening in Google Sheets works once Google sign-in is connected. In this preview, use Download .xlsx instead.');
      return;
    }
    setSheetsBusy(true);
    try {
      const name = workbookFileName(agent.name).replace(/\.xlsx$/, '').replace(/_/g, ' ');
      const buf = await makeWorkbook();
      let url: string;
      try {
        url = await uploadAsGoogleSheet(buf, name, await getDriveToken());
      } catch (e) {
        if (!(e instanceof DriveError) || e.code !== 'expired') throw e;
        forgetDriveToken();
        url = await uploadAsGoogleSheet(buf, name, await getDriveToken());
      }
      patch({ sheetUrl: url });
      // Browsers often block a new tab opened after a wait; the button turns into a link either way.
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      const cancelled = e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request';
      if (!cancelled) {
        console.error(e);
        setNotice("We couldn't create your Google Sheet. Use Download .xlsx, then open the file from Google Drive.");
      }
    } finally {
      setSheetsBusy(false);
    }
  };

  const startOver = async () => {
    if (agent) await clearProgress(agent);
    setEmailStatus('off');
    setState({ ...EMPTY, step: 'upload' });
  };

  const handleSignOut = async () => {
    await signOut();
    setAgent(null);
  };

  const firstIncomplete = () => {
    const i = state.deals.findIndex((d) => missingFields(d).length > 0);
    return i === -1 ? 0 : i;
  };

  let body: React.ReactNode;
  if (agent === undefined || (agent && !loaded)) {
    body = (
      <div className="grid place-items-center py-32 text-slate">
        <Loader2 className="animate-spin" />
      </div>
    );
  } else if (!agent) {
    body = <Welcome onSignedIn={setAgent} />;
  } else {
    switch (state.step) {
      case 'instructions':
        body = (
          <Instructions
            onNext={() => patch({ step: 'upload' })}
            savedDeals={state.deals.filter((d) => !d.excluded).length}
            onResume={() =>
              patch({ step: state.submittedAt ? 'done' : state.reachedReview ? 'review' : state.deals.length ? 'enrich' : 'upload' })
            }
            onStartOver={startOver}
          />
        );
        break;
      case 'upload':
        body = (
          <Upload
            deals={state.deals}
            fileNames={state.fileNames}
            onChange={(deals, fileNames) => patch({ deals, fileNames, index: 0, reachedReview: deals.length ? state.reachedReview : false })}
            onNext={() => patch({ step: state.reachedReview ? 'review' : 'enrich', index: firstIncomplete() })}
          />
        );
        break;
      case 'enrich':
        body = state.deals[state.index] ? (
          <DealCard
            deals={state.deals}
            index={state.index}
            onUpdate={updateDeal}
            onNext={next}
            onPrev={prev}
            onJump={(i) => patch({ index: i })}
            returnToReview={state.reachedReview}
          />
        ) : null;
        break;
      case 'review':
        body = (
          <Review
            deals={state.deals}
            building={building}
            onEdit={(i) => patch({ index: i, step: 'enrich' })}
            onAddFiles={() => patch({ step: 'upload' })}
            onBuild={() => patch({ step: 'expenses' })}
          />
        );
        break;
      case 'expenses':
        body = (
          <ExpensesStep
            expenses={state.expenses ?? {}}
            onChange={(expenses) => patch({ expenses })}
            onBack={() => patch({ step: 'review' })}
            onBuild={build}
            building={building}
          />
        );
        break;
      case 'done':
        body = (
          <Done
            email={agent.email}
            deals={state.deals}
            emailStatus={emailStatus}
            submittedAt={state.submittedAt}
            onDownload={download}
            onOpenSheets={openInSheets}
            sheetUrl={state.sheetUrl ?? null}
            sheetsBusy={sheetsBusy}
            onEdit={() => patch({ step: 'review' })}
            onStartOver={startOver}
          />
        );
        break;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        agent={agent ?? null}
        status={agent ? saveStatus : 'idle'}
        onSignOut={handleSignOut}
        onHome={agent && loaded ? () => patch({ step: 'instructions' }) : undefined}
      />
      {notice && (
        <div className="max-w-3xl mx-auto mt-6 px-5 w-full">
          <p className="rounded-xl bg-amber-tint border border-[#f1d3a8] px-4 py-3 text-[15px] text-[#5c3a10]">{notice}</p>
        </div>
      )}
      <main className="flex-1">{body}</main>
      <footer className="py-10 text-center text-[13px] text-faint">
        <a href="https://janienation.com" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
          janienation.com
        </a>
      </footer>
    </div>
  );
};

export default App;
