// Re-pull the latest Master List from the published Google Sheet.
//   node scripts/refresh.mjs
// Overwrites data/master-list.csv. Run `npm run build` afterwards (or use
// `npm run update`, which does both).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = '1VOjzatpLBRhArbz7qYiYcYj2Sur7Na-fxaAQTluMWIg';
const GID = '0';
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const dest = path.resolve(__dirname, '..', 'data', 'master-list.csv');

const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`✗ Failed to fetch sheet (HTTP ${res.status}). Is it still shared as "anyone with the link"?`);
  process.exit(1);
}
const csv = await res.text();
if (!/PFC/i.test(csv)) {
  console.error('✗ Downloaded file does not look like the Master List. Aborting to avoid overwriting good data.');
  process.exit(1);
}
fs.writeFileSync(dest, csv, 'utf8');
console.log(`✓ Refreshed ${path.relative(path.resolve(__dirname, '..'), dest)} (${csv.length.toLocaleString()} bytes)`);
