// Data layer for the PFC Master List.
// Parses the Google-Sheet CSV export into a clean, normalized model that the
// site generator bakes into static HTML. Kept deliberately defensive: the
// source sheet is hand-maintained, so cells are multi-line, inconsistently
// cased, and occasionally typo'd. Nothing here throws on messy input.

import fs from 'node:fs';

/* ---------------------------------------------------------------- CSV parse */
// Minimal RFC-4180 parser: handles quoted fields, embedded newlines and
// escaped double-quotes. Returns an array of rows (arrays of string cells).
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore – newline handling is driven by \n
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/* -------------------------------------------------------------- normalizers */
const clean = (s) => (s ?? '').replace(/ /g, ' ').trim();
const lines = (s) => clean(s).split(/\n+/).map(clean).filter(Boolean);

export function slugify(name) {
  return clean(name)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'shop';
}

const PLATFORM_MAP = {
  facebook: 'Facebook',
  fb: 'Facebook',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  ig: 'Instagram',
  lazada: 'Lazada',
  shopee: 'Shopee',
};
function normPlatform(raw) {
  const key = clean(raw).toLowerCase().replace(/[^a-z]/g, '');
  return PLATFORM_MAP[key] || (key ? clean(raw) : null);
}

// Category synonyms → canonical label. Anything not mapped is title-cased and
// kept, so new categories added to the sheet still surface (just un-grouped).
const CATEGORY_MAP = {
  'middle eastern': 'Middle Eastern',
  'middle-eastern': 'Middle Eastern',
  'middle east': 'Middle Eastern',
  'designers': 'Designers',
  'designer': 'Designers',
  'niche': 'Niche',
  'local niche': 'Local Niche',
  'local inspired': 'Local-Inspired',
  'local-inspired': 'Local-Inspired',
  'local inspiired': 'Local-Inspired',
  'local-inspiired': 'Local-Inspired',
  'decants': 'Decants',
  'own blends': 'Own Blends',
  'own blend': 'Own Blends',
  'aromatheraphy': 'Aromatherapy',
  'aromatherapy': 'Aromatherapy',
  'pasabuy': 'Pasabuy',
  'pasabuys': 'Pasabuy',
  'groceries': 'Groceries',
  'jewelry': 'Jewelry',
  'bbw': 'Bath & Body Works',
  'bath and body works': 'Bath & Body Works',
  'vs': "Victoria's Secret",
  'minis': 'Minis',
  'mini': 'Minis',
};
const CATEGORY_DROP = new Set(['etc', 'etc.', '', 'and']);

function titleCase(s) {
  return clean(s).replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function normCategories(raw) {
  let text = clean(raw);
  if (!text) return { categories: [], sellsDecants: false };

  // "Decants: Designers, Niche" — mark as decants AND keep the listed types.
  const sellsDecants = /decants/i.test(text);
  text = text.replace(/decants\s*:/gi, ','); // turn the "Decants:" prefix into a separator

  const out = [];
  const seen = new Set();
  const add = (canon) => { if (canon && !seen.has(canon)) { seen.add(canon); out.push(canon); } };

  const handlePart = (rawPart) => {
    // Strip noise words; "X Decants" → "X" (the decants flag is tracked separately).
    let part = clean(rawPart).replace(/\bperfumes?\b/gi, '').replace(/\bdecants\b/gi, '').trim();
    if (!part) return;
    const key = part.toLowerCase().replace(/[.\s]+$/, '').trim();
    if (CATEGORY_DROP.has(key)) return;
    if (CATEGORY_MAP[key]) return add(CATEGORY_MAP[key]);
    // Unmapped compound like "Designers and Niche" → split and recurse.
    if (/\band\b/i.test(part)) return part.split(/\band\b/i).forEach(handlePart);
    add(titleCase(part));
  };

  text.split(/[,/]/).forEach(handlePart);
  if (sellsDecants && !seen.has('Decants')) { out.unshift('Decants'); seen.add('Decants'); }
  return { categories: out, sellsDecants };
}

// Best-effort region grouping from a free-text PH address. Only used to power a
// location filter; unmatched / online-only shops fall through to null.
const REGION_RULES = [
  ['Metro Manila', /navotas|caloocan|para[nñ]aque|quezon city|diliman|teachers village|pasay|taguig|bicutan|nbbs|sangandaan|\bmnl\b|manila/i],
  ['Bulacan', /bulacan|baliuag|baliwag|bustos|nesabel/i],
  ['Batangas', /batangas|nasugbu|santo tomas|sto\.? tomas/i],
  ['Baguio / Benguet', /baguio|benguet|porta vaga|session road/i],
  ['Laguna', /laguna|san pablo/i],
  ['Bataan', /bataan/i],
  ['Ilocos / Abra', /ilocos|abra/i],
];
function deriveRegion(address) {
  const a = clean(address);
  if (!a) return null;
  for (const [region, re] of REGION_RULES) if (re.test(a)) return region;
  return 'Other (PH)';
}
// Short display label: most specific recognizable place, else trimmed tail.
function deriveLocationLabel(address) {
  const a = clean(address).replace(/\s+/g, ' ');
  if (!a) return null;
  const segs = a.split(',').map((s) => s.trim().replace(/^[^A-Za-z0-9]+/, '').trim()).filter(Boolean);
  return segs.length ? segs[segs.length - 1] : a;
}

function extractUrls(cell) {
  const found = clean(cell).match(/https?:\/\/[^\s,]+/gi) || [];
  return [...new Set(found.map((u) => u.replace(/[.,)\]]+$/, '')))];
}

/* --------------------------------------------------------------- row → shop */
const HEADER_FIRST_CELL = /^shop name$/i;

function makeShop(row, tier) {
  const nameCell = clean(row[0]);
  const nameParts = lines(row[0]);
  const name = nameParts[0] || nameCell;
  const altNames = nameParts.slice(1);

  const platforms = [...new Set(lines(row[1]).map(normPlatform).filter(Boolean))];
  const linkCell = row[2] || '';
  const urls = extractUrls(linkCell);
  const linkUnavailable = /unavailable/i.test(linkCell);

  const { categories, sellsDecants } = normCategories(row[3]);
  const address = clean(row[4]);
  const documents = lines(row[5]).map((d) => d.replace(/^[✓✔»\-•\s]+/, '').trim()).filter(Boolean);
  const certificate = clean(row[6]);
  const validity = clean(row[7]);

  return {
    id: slugify(name),
    name,
    altNames,
    tier, // 'preferred' | 'community'
    platforms,
    storeLink: urls[0] || null,
    links: urls,
    linkUnavailable,
    categories,
    sellsDecants,
    address,
    hasPhysicalStore: Boolean(address),
    region: deriveRegion(address),
    location: deriveLocationLabel(address),
    documents,
    certificate,
    validity,
  };
}

/* -------------------------------------------------------------- the loader */
export function loadData(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(raw);

  const meta = { mission: '', preferredIntro: '', communityIntro: '' };
  const shops = [];
  let tier = null;

  for (const row of rows) {
    const c0 = clean(row[0]);
    const joined = row.map(clean).join(' ');

    // Section markers can appear in col0 (preferred/community blocks).
    if (/^PFC\s*-\s*PREFERRED SHOPS/i.test(c0)) {
      meta.preferredIntro = c0.replace(/^PFC\s*-\s*PREFERRED SHOPS\s*/i, '').trim();
      tier = 'preferred';
      continue;
    }
    if (/NON-?\s*PFC[- ]?PREFERRED SHOPS/i.test(c0)) {
      meta.communityIntro = c0.replace(/^NON-?\s*PFC[- ]?PREFERRED SHOPS\s*/i, '').trim();
      tier = 'community';
      continue;
    }

    // Mission/welcome paragraph lives in an upper cell, not col0.
    if (!meta.mission) {
      const m = row.map(clean).find((cell) => /official directory ng/i.test(cell));
      if (m) meta.mission = m;
    }

    if (!tier) continue;                       // not yet inside a section
    if (!c0) continue;                          // blank spacer row
    if (HEADER_FIRST_CELL.test(c0)) continue;   // column header row
    if (!extractUrls(row[2]).length && lines(row[1]).length === 0 && !clean(row[2])) continue;

    shops.push(makeShop(row, tier));
  }

  // De-dupe slug collisions (e.g. "One Whiff Wonder" / "… II").
  const slugCount = new Map();
  for (const s of shops) {
    const n = (slugCount.get(s.id) || 0) + 1;
    slugCount.set(s.id, n);
    if (n > 1) s.id = `${s.id}-${n}`;
  }

  return { meta, shops };
}

/* -------------------------------------------------- aggregate facet helpers */
export function buildFacets(shops) {
  const count = (arr) => {
    const m = new Map();
    for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    categories: count(shops.flatMap((s) => s.categories)),
    regions: count(shops.map((s) => s.region).filter(Boolean)),
    tiers: count(shops.map((s) => s.tier)),
  };
}
