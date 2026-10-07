// ---------------------------------------------------------------
// Settings you may want to change between training runs.
// ---------------------------------------------------------------

// The year being assessed. Only deals that closed between these
// dates are included. To use "last 12 months" instead, change
// the start and end dates.
export const ASSESSMENT = {
  year: 2026,
  start: '2026-01-01',
  end: '2026-12-31',
};

// The planning year shown on the goals tabs.
export const GOAL_YEAR = ASSESSMENT.year + 1;

export const APP_NAME = 'Business Planning Series';

// Zapier "Catch Hook" URL. The finished spreadsheet is sent here
// so Zapier can email it to the agent and save a copy to Drive.
// Leave as-is to turn the email step off (downloads still work).
export const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/21530697/4mnbms9/';

// Only these email domains can sign in.
export const ALLOWED_DOMAIN = 'compass.com';

// Firestore collection for this app inside the shared Firebase project.
export const FIRESTORE_COLLECTION = 'businessPlanningSeries';

// ---------------------------------------------------------------
// Sources of business. Labels match the spreadsheet template
// exactly, so changing a label here changes it in the workbook.
// ---------------------------------------------------------------
export type SourceKey = 'soi' | 'openHouse' | 'leads' | 'referrals' | 'other';

export interface SourceDef {
  key: SourceKey;
  label: string;
  description: string;
  color: string;
  // Leave detailPrompt out to skip the follow-up question for that source.
  detailPrompt?: string;
  detailPlaceholder?: string;
  detailRequired: boolean;
}

export const SOURCES: SourceDef[] = [
  {
    key: 'soi',
    label: 'Past Clients & SOI',
    description: 'You already knew them: friends, family, neighbors, past clients.',
    color: '#9DBFE8',
    detailRequired: false,
  },
  {
    key: 'referrals',
    label: 'Referrals',
    description: 'Someone sent them to you: another agent, a past client, a friend.',
    color: '#9FD5BD',
    detailRequired: false,
  },
  {
    key: 'openHouse',
    label: 'Open House',
    description: 'You met them at an open house, yours or one you hosted.',
    color: '#F3D493',
    detailRequired: false,
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Online or paid sources: Zillow, social media, ads, your website.',
    color: '#C2B3EC',
    detailRequired: false,
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Anything else: sign calls, relocation companies, walk-ins.',
    color: '#F0B3AE',
    detailRequired: false,
  },
];

export const sourceByKey = (key: string) => SOURCES.find((s) => s.key === key);
