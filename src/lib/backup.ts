import { ASSESSMENT, DRIVE_BACKUP_KEY, DRIVE_BACKUP_URL } from '../config';

// Saves a copy of a finished workbook to the program's Google Drive folder through
// a Google Apps Script web app (see drive-backup-apps-script.gs). No Zapier involved.

export const backupReady = !import.meta.env.VITE_PREVIEW && DRIVE_BACKUP_URL.startsWith('https://script.google.com/');

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Returns true once the script confirms the file was saved. Tries up to three times.
export const backupToDrive = async (
  buf: ArrayBuffer,
  agent: { name: string; email: string },
  dealCount: number,
): Promise<boolean> => {
  if (!backupReady) return false;
  // text/plain keeps this a "simple" request, which Apps Script accepts from any site.
  const body = JSON.stringify({
    key: DRIVE_BACKUP_KEY,
    agentName: agent.name,
    agentEmail: agent.email,
    dealCount,
    title: `Business Plan ${ASSESSMENT.year}`,
    file: toBase64(buf),
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(DRIVE_BACKUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) return true;
      if (data?.error) console.warn('Drive backup refused:', data.error);
    } catch (e) {
      console.warn('Drive backup attempt failed', e);
    }
    await wait(1500 * (attempt + 1));
  }
  return false;
};
