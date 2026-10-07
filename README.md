# Compass Business Planning Series

Agents sign in with their @compass.com Google account, upload their Business Tracker CSV,
tag each deal with a client and source of business, and download a finished workbook
(built in the browser). Zapier emails a copy and saves one to Google Drive.

## Files you might edit

- `src/config.ts`: assessment year and dates, Zapier webhook URL, source names and descriptions.
- `src/firebase-config.ts`: the SignatureStudio Firebase web config.
- `public/fonts/`: Compass Sans font files.

## One-time setup

1. **Firebase config.** Copy the config values from the SignatureStudio project
   (Firebase console > Project settings > General > Your apps) into `src/firebase-config.ts`.
2. **Firestore rules.** Add the block in `firestore-rules-addition.txt` to the existing rules. Do not replace them.
3. **Authorized domain.** Firebase console > Authentication > Settings > Authorized domains > Add domain,
   and add this app's subdomain (`bp.janienation.com`).
4. **Zapier.** Create a Zap with a "Webhooks by Zapier: Catch Hook" trigger and paste its URL into
   `WEBHOOK_URL` in `src/config.ts`. The hook receives `file` (the .xlsx), `agentName`, `agentEmail`, `dealCount`.
   Actions: Gmail "Send Email" with `file` as the attachment, and Google Drive "Upload File" with `file`.
   In the Drive step, leave "Convert to Document" set to No so the formulas stay intact.
5. **Open in Google Sheets.** In the Google Cloud console for the SignatureStudio project
   (console.cloud.google.com, same project ID as Firebase): APIs & Services > Library > enable **Google Drive API**.
   Then APIs & Services > OAuth consent screen > Data access (or Scopes) > add `.../auth/drive.file`.
   This lets the app create the agent's workbook as a Google Sheet in their own Drive; it cannot see their other files.
   If agents get an "access blocked" message, a Compass Google Workspace admin needs to allow the app
   (Admin console > Security > API controls).
6. **Deploy.** New GitHub repo with these files, import it into Vercel (framework: Vite), then add the custom domain
   in Vercel and a CNAME record for it in GoDaddy pointing to `cname.vercel-dns.com`.

## Live site

https://bp.janienation.com (Vercel, auto-deploys from GitHub). The Claude preview build
(`vite.preview.config.ts`) stays in local test mode with no sign-in and no Zapier calls.

## Commands

    npm install
    npm run dev      # local preview
    npm run build    # production build (Vercel runs this for you)
