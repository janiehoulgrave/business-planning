import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ALLOWED_DOMAIN, ASSESSMENT, GOAL_YEAR } from '../config';
import { Agent, cloudEnabled, isAllowedEmail, signInLocal, signInWithGoogle } from '../lib/store';
import { Button, inputClass, Label } from './ui';
import { Mark } from './TopBar';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export const Welcome: React.FC<{ onSignedIn: (a: Agent) => void }> = ({ onSignedIn }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const google = async () => {
    setError('');
    setBusy(true);
    try {
      onSignedIn(await signInWithGoogle());
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        setError(e?.message?.startsWith('Sign in') ? e.message : 'Sign-in did not finish. Try again, and allow pop-ups for this site if your browser blocked one.');
      }
    } finally {
      setBusy(false);
    }
  };

  const local = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowedEmail(email.trim())) {
      setError(`Use your @${ALLOWED_DOMAIN} email address.`);
      return;
    }
    onSignedIn(signInLocal(name.trim(), email.trim()));
  };

  return (
    <div className="step-in max-w-5xl mx-auto px-5 pt-12 pb-16 md:pt-20 grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-16 items-center">
      <div>
        <h1 className="text-[40px] md:text-[56px] leading-[1.04] font-bold tracking-[-0.02em] max-w-[14ch]">
          See where your {ASSESSMENT.year} business came from.
        </h1>
        <p className="mt-6 text-[18px] leading-relaxed text-slate max-w-[52ch]">
          Upload the deals you closed this year from your Compass Business Tracker, tell us how you met each client, and
          walk away with a finished workbook for planning {GOAL_YEAR}.
        </p>
        <p className="mt-4 text-[15px] text-slate">Most agents finish in 15 to 20 minutes.</p>
      </div>

      <div className="bg-paper rounded-3xl border border-line p-7 md:p-9 shadow-[0_1px_0_#d7dde4,0_20px_40px_-24px_rgba(15,30,50,0.25)]">
        <div className="text-ink mb-6">
          <Mark size={44} />
        </div>
        {cloudEnabled ? (
          <>
            <h2 className="text-[22px] font-bold mb-2">Sign in to start</h2>
            <p className="text-[15px] text-slate mb-7 leading-relaxed">
              Use your @{ALLOWED_DOMAIN} account. Your answers save as you go, so you can stop and pick up later on any device.
            </p>
            <Button size="lg" className="w-full" onClick={google} disabled={busy}>
              <span className="bg-paper rounded-full p-1 grid place-items-center">
                <GoogleG />
              </span>
              {busy ? 'Opening sign-in' : 'Sign in with Google'}
            </Button>
          </>
        ) : (
          <form onSubmit={local} className="space-y-5">
            <h2 className="text-[22px] font-bold">Tell us who you are</h2>
            <div>
              <Label htmlFor="name">Full name</Label>
              <input id="name" required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="email">Compass email</Label>
              <input
                id="email"
                type="email"
                required
                className={inputClass}
                value={email}
                placeholder={`name@${ALLOWED_DOMAIN}`}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                autoComplete="email"
              />
            </div>
            <Button size="lg" className="w-full" type="submit">
              Get started <ArrowRight size={18} />
            </Button>
            <p className="text-[13px] text-slate">Progress saves in this browser only.</p>
          </form>
        )}
        {error && <p className="mt-4 text-[14px] text-amber">{error}</p>}
      </div>
    </div>
  );
};
