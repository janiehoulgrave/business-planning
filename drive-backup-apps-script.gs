/**
 * Business Planning Series: save a copy of every finished workbook to Google Drive.
 *
 * Setup (once):
 * 1. Go to script.google.com, signed in to the Google account that owns (or can add files to)
 *    the backup folder. New project. Paste this whole file in place of the sample code.
 * 2. Set FOLDER_ID below: open the folder in Drive and copy the long ID at the end of its link
 *    (drive.google.com/drive/folders/THIS_PART).
 * 3. Deploy > New deployment > type "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 *    Click Deploy, approve the Google permissions, and copy the Web app URL (ends in /exec).
 * 4. Send that URL to be added to the app (DRIVE_BACKUP_URL in src/config.ts).
 *
 * KEY must match DRIVE_BACKUP_KEY in the app's src/config.ts.
 */

const FOLDER_ID = 'PASTE_FOLDER_ID_HERE';
const KEY = 'TZEUPyu99jIhrqgA_b4pwFOXCJk7EzFh';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return reply({ ok: false, error: 'not allowed' });

    const email = String(body.agentEmail || '').trim().toLowerCase();
    const name = String(body.agentName || '').trim() || email;
    if (!/@compass\.com$/.test(email)) return reply({ ok: false, error: 'not a compass.com account' });

    // One file per agent: "Jane Smith (jane.smith@compass.com) - Business Plan 2026.xlsx".
    // Building again replaces their earlier copy (the old one goes to Drive's trash for 30 days).
    const fileName = clean(name) + ' (' + email + ') - ' + clean(String(body.title || 'Business Plan')) + '.xlsx';
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const old = folder.getFilesByName(fileName);
    while (old.hasNext()) old.next().setTrashed(true);

    const blob = Utilities.newBlob(Utilities.base64Decode(body.file), XLSX, fileName);
    const file = folder.createFile(blob);
    file.setDescription(name + ' <' + email + '>, ' + (body.dealCount || 0) + ' deal sides, saved ' + new Date().toString());
    return reply({ ok: true, id: file.getId() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Visiting the URL in a browser shows this, so you can check the deployment is live.
function doGet() {
  return reply({ ok: true, status: 'Business Planning backup is running' });
}

function clean(s) {
  return s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
