const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class DriveError extends Error {
  constructor(public code: 'expired' | 'failed', public status?: number) {
    super(code);
  }
}

// Uploads the workbook to the agent's Google Drive, converted to a Google Sheet.
// Returns the link that opens it in Google Sheets.
export const uploadAsGoogleSheet = async (buf: ArrayBuffer, name: string, token: string): Promise<string> => {
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name, mimeType: 'application/vnd.google-apps.spreadsheet' })], { type: 'application/json' }),
  );
  form.append('file', new Blob([buf], { type: XLSX_TYPE }));
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (res.status === 401) throw new DriveError('expired', 401);
  if (!res.ok) throw new DriveError('failed', res.status);
  const file = await res.json();
  return file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
};
