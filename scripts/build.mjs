// Static-site generator for the PFC Master List.
//   node scripts/build.mjs
// Reads data/master-list.csv → writes a fully static site into /docs
// (index + one page per shop + assets). No framework, no client deps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, buildFacets } from './lib/data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');

// Set this to your published URL (e.g. https://username.github.io/pfc-master-list)
// to emit absolute canonical/OG URLs + a sitemap. Leave '' for relative-only.
const SITE_URL = '';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1VOjzatpLBRhArbz7qYiYcYj2Sur7Na-fxaAQTluMWIg/edit?gid=0#gid=0';

/* --------------------------------------------------------------- helpers */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const buildDate = new Date();
const fmtDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const TIER_LABEL = { preferred: 'PFC-Preferred', community: 'Community-Verified' };

// "A" · "A and B" · "A, B, and C"
function joinList(arr) {
  if (arr.length <= 1) return arr[0] || '';
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
}

function validityStatus(validity) {
  if (!validity) return null;
  const d = new Date(validity);
  if (isNaN(+d)) return null;
  const days = (d - buildDate) / 86400000;
  if (days < 0) return { cls: 'expired', label: 'Lapsed' };
  if (days < 75) return { cls: 'soon', label: 'Renewing soon' };
  return { cls: 'active', label: 'Active' };
}

function platformFromUrl(url) {
  const u = url.toLowerCase();
  if (u.includes('shopee')) return 'Shopee';
  if (u.includes('lazada')) return 'Lazada';
  if (u.includes('facebook') || u.includes('fb.com')) return 'Facebook';
  if (u.includes('tiktok')) return 'TikTok';
  if (u.includes('instagram')) return 'Instagram';
  return 'Website';
}

/* --------------------------------------------------------------- icons */
const I = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.3l.4-3h-2.7V9.2c0-.9.3-1.5 1.6-1.5H16V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.8V11H8v3h2.2v7z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.6 3.6 3.9v2.4c-1.3 0-2.6-.4-3.6-1.1v5.6a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.5a2.9 2.9 0 1 0 2 2.7V3z"/></svg>',
  shopee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M10.5 13c0 1 .8 1.5 1.7 1.5s1.6-.4 1.6-1.3c0-1.7-3-1.1-3-2.7 0-.7.6-1.2 1.5-1.2"/></svg>',
  lazada: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
  seal: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M32 4l5.5 4.2 6.8-1 2.6 6.4 6.4 2.6-1 6.8L62 32l-4.2 5.5 1 6.8-6.4 2.6-2.6 6.4-6.8-1L32 60l-5.5-4.2-6.8 1-2.6-6.4-6.4-2.6 1-6.8L2 32l4.2-5.5-1-6.8 6.4-2.6 2.6-6.4 6.8 1z"/><path d="M24 32l5.5 5.5L41 26" stroke-width="2"/></svg>',
  mark: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="20" y="3" width="24" height="24" transform="rotate(45 20 20)" rx="2"/><path d="M20 13c2.2 2.6 2.2 11.4 0 14-2.2-2.6-2.2-11.4 0-14z" fill="currentColor" stroke="none"/><circle cx="20" cy="27" r="1.6" fill="currentColor" stroke="none"/></svg>',
};
const platformIcon = (p) => I[p.toLowerCase()] || I.globe;

/* --------------------------------------------------------- shared chrome */
function pageHead(title, desc, base, canonicalPath) {
  const canon = SITE_URL && canonicalPath ? `${SITE_URL}/${canonicalPath}` : '';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0C0B09">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${canon ? `<link rel="canonical" href="${esc(canon)}">\n<meta property="og:url" content="${esc(canon)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/styles.css">
<!--/HEAD-->`;
}

function header(base) {
  return `<header class="site-head"><div class="wrap site-head__inner">
  <a class="brand" href="${base}index.html" aria-label="PFC Master List — home">
    <span class="brand__mark">${I.mark}</span>
    <span class="brand__text"><span class="brand__name">The Master List</span><span class="brand__sub">Pinoy Fragheads</span></span>
  </a>
  <nav class="nav" aria-label="Primary">
    <a href="${base}index.html#about">The Standard</a>
    <a href="${base}index.html?tier=preferred">PFC-Preferred</a>
    <a href="${base}index.html?tier=community">Community</a>
    <a class="nav__cta" href="${base}index.html#register">Explore →</a>
  </nav>
</div></header>`;
}

function footer(base, meta) {
  const disclaimer = `This is an independent, community-made directory. Shop data is sourced from the Pinoy Fragheads Community (PFC) Official Master List. This project is not officially affiliated with, endorsed by, or operated by PFC. Inclusion on this list does not constitute a guarantee, warranty, or assumption of liability for any transaction. Even with curated and PFC-Preferred shops, always practice due diligence before you buy. Stay smart and responsible consumers.`;
  return `<footer class="site-foot"><div class="wrap">
  <div class="foot__grid">
    <div class="foot__brand">
      <a class="brand" href="${base}index.html"><span class="brand__mark">${I.mark}</span>
        <span class="brand__text"><span class="brand__name">The Master List</span><span class="brand__sub">Pinoy Fragheads</span></span></a>
      <p>A connoisseur's register of trusted Philippine fragrance shops — curated, secured, and vouched for by the community.</p>
    </div>
    <div class="foot__col">
      <h4>Browse</h4>
      <a href="${base}index.html#register">The full register</a>
      <a href="${base}index.html?tier=preferred">PFC-Preferred shops</a>
      <a href="${base}index.html?tier=community">Community-verified</a>
      <a href="${base}index.html?cat=Local-Inspired">Local-Inspired</a>
      <a href="${base}index.html?cat=Middle%20Eastern">Middle Eastern</a>
      <a href="${base}index.html?cat=Decants">Decants</a>
    </div>
    <div class="foot__col">
      <h4>Community</h4>
      <span class="placeholder-link">PFC on Facebook — add link</span>
      <span class="placeholder-link">PFC on TikTok — add link</span>
      <span class="placeholder-link">PFC on Instagram — add link</span>
      <a href="${esc(SHEET_URL)}" target="_blank" rel="noopener">Master List source ↗</a>
    </div>
  </div>
  <p class="disclaimer">${esc(disclaimer)}</p>
  <div class="foot__base">
    <span>© ${buildDate.getFullYear()} · An independent project · Updated ${fmtDate(buildDate)}</span>
    <span class="foot__sign">Gawin nating mabango ang Pilipinas ✦</span>
  </div>
</div></footer>`;
}

/* ------------------------------------------------------------------ card */
function shopCard(s, base) {
  const tierCls = s.tier === 'preferred' ? 'pref' : 'comm';
  const badge = s.tier === 'preferred'
    ? `<span class="badge badge--pref">${I.seal}PFC-Preferred</span>`
    : `<span class="badge badge--comm">Community</span>`;
  const cats = s.categories.slice(0, 3).map((c) => `<span class="tag">${esc(c)}</span>`).join('');
  const more = s.categories.length > 3 ? `<span class="tag tag--more">+${s.categories.length - 3}</span>` : '';
  const loc = s.region
    ? `<span class="mi">${I.pin}${esc(s.region)}</span>`
    : `<span class="mi">${I.globe}Online</span>`;
  const plats = s.platforms.map((p) => `<span title="${esc(p)}">${platformIcon(p)}</span>`).join('');
  const cert = s.certificate ? `<span class="card__cert">No. ${esc(s.certificate)}</span>` : '';
  const alt = s.altNames.length ? `<div class="card__alt">also ${esc(s.altNames.join(' · '))}</div>` : '';

  const searchBlob = [s.name, ...s.altNames, ...s.categories, s.location, s.region]
    .filter(Boolean).join(' ').toLowerCase();

  return `<a class="card-link reveal card card--${tierCls}" href="${base}shop/${s.id}.html"
    data-tier="${s.tier}" data-cats="${esc(s.categories.join('|'))}" data-region="${esc(s.region || '')}"
    data-store="${s.hasPhysicalStore ? 1 : 0}" data-name="${esc(s.name)}" data-rank="${s.rank}"
    data-search="${esc(searchBlob)}">
    <div class="card__top">${badge}</div>
    <h3 class="card__name">${esc(s.name)}</h3>${alt}
    <div class="tags">${cats}${more}</div>
    <div class="card__meta">${loc}<span class="platforms">${plats}</span></div>
    <div class="card__foot"><span class="card__view">View shop <span class="btn__arrow">→</span></span>${cert}</div>
  </a>`;
}

/* ------------------------------------------------------------- index page */
function indexPage(meta, shops, facets) {
  const total = shops.length;
  const pref = shops.filter((s) => s.tier === 'preferred').length;
  const comm = total - pref;
  const catCount = facets.categories.length;

  const topCats = facets.categories.filter(([, n]) => n >= 3); // primary chips
  const chips = topCats.map(([c, n]) =>
    `<button class="chip" data-cat="${esc(c)}" aria-pressed="false" type="button">${esc(c)}<span class="chip__count">${n}</span></button>`).join('');

  const regionOpts = facets.regions
    .map(([r, n]) => `<option value="${esc(r)}">${esc(r)} (${n})</option>`).join('');

  const cards = shops.map((s) => shopCard(s, '')).join('\n');

  const prefIntro = meta.preferredIntro.split('\n')[0] ||
    'Shops that have submitted business documents, actively participate in the community, and are well-vouched by members. Each is issued a certificate of inclusion.';
  const commIntro = meta.communityIntro.split('\n')[0] ||
    'Shops well-known within the community whose links are verified, but which PFC has not internally reviewed. Exercise due diligence.';

  const desc = `An independent, connoisseur's directory of ${total} trusted Philippine fragrance shops — ${pref} PFC-Preferred with verified documents — curated by the Pinoy Fragheads Community.`;

  return `<!-- generated by scripts/build.mjs — edit src/ + data/, then \`npm run build\` -->
${pageHead('The Master List — Trusted Philippine Fragrance Shops', desc, '', 'index.html')}
${header('')}
<main>
  <section class="hero">
    <div class="hero__glow"></div>
    <div class="hero__glyph" aria-hidden="true">P</div>
    <div class="wrap hero__inner">
      <p class="eyebrow">Pinoy Fragheads Community</p>
      <h1>A curated register of the Philippines' most <em>trusted</em> fragrance houses.</h1>
      <p class="hero__lede">${total} community-vetted shops — ${pref} of them <strong style="color:var(--gold-bright);font-weight:500">PFC-Preferred</strong>, with business documents verified and certificates on file. Browse by house, category, or city, then buy with confidence.</p>
      <p class="hero__tagline">Gawin nating mabango ang Pilipinas — one Filipino at a time.</p>
      <div class="hero__actions">
        <a class="btn btn--gold" href="#register">Explore the register <span class="btn__arrow">↓</span></a>
        <a class="btn btn--ghost" href="#about">What is PFC-Preferred?</a>
      </div>
      <div class="hero__stats">
        <div class="stat"><div class="stat__num" data-count="${total}">${total}</div><div class="stat__label">Vetted shops</div></div>
        <div class="stat"><div class="stat__num" data-count="${pref}">${pref}</div><div class="stat__label">PFC-Preferred</div></div>
        <div class="stat"><div class="stat__num" data-count="${comm}">${comm}</div><div class="stat__label">Community-verified</div></div>
        <div class="stat"><div class="stat__num" data-count="${catCount}">${catCount}</div><div class="stat__label">Categories</div></div>
      </div>
    </div>
    <div class="scroll-cue"><span>Scroll</span><span class="scroll-cue__line"></span></div>
  </section>

  <section class="about section" id="about">
    <div class="wrap about__grid">
      <div>
        <p class="eyebrow">About the list</p>
        <p class="about__lede">The official directory of carefully curated, <b>secured, and trusted</b> fragrance shops recommended by the Pinoy Fragheads Community.</p>
        <div class="about__body">
          <p>Every shop here has passed community evaluation — based on personal experience, verified distributors or legitimate sourcing, and strong vouching from members over time. Curated as it is, we still encourage everyone to practice due diligence before buying.</p>
          <blockquote class="pullquote">Let's keep supporting legit shops, local brands, and gawin nating mabango ang Pilipinas, one Filipino at a time.</blockquote>
        </div>
      </div>
      <div class="tiers">
        <div class="tier-card tier-card--pref">
          <h3>${I.seal} PFC-Preferred</h3>
          <p>${esc(prefIntro)}</p>
        </div>
        <div class="tier-card tier-card--comm">
          <h3>Community-Verified</h3>
          <p>${esc(commIntro)}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="register">
    <div class="wrap">
      <div class="section__head">
        <p class="eyebrow">The register</p>
        <h2 class="section__title">Every vetted shop, in one place.</h2>
        <p class="section__intro">Search by name, filter by craft or city, and switch between PFC-Preferred and the wider community.</p>
      </div>

      <div class="controls" role="search">
        <div class="controls__row">
          <label class="search">
            <span class="visually-hidden"></span>${I.search}
            <input id="search" type="search" placeholder="Search shops, categories, locations…" aria-label="Search shops">
          </label>
          <div class="segmented" role="group" aria-label="Filter by tier">
            <button data-tier="all" aria-pressed="true" type="button">All</button>
            <button data-tier="preferred" aria-pressed="false" type="button">Preferred</button>
            <button data-tier="community" aria-pressed="false" type="button">Community</button>
          </div>
          <div class="field">
            <select id="region" aria-label="Filter by location">
              <option value="all">All locations</option>
              ${regionOpts}
              <option value="__online">Online only</option>
            </select>
          </div>
          <div class="field">
            <select id="sort" aria-label="Sort shops">
              <option value="featured">Sort · Featured</option>
              <option value="az">Sort · A–Z</option>
              <option value="za">Sort · Z–A</option>
            </select>
          </div>
        </div>
        <div class="chips" role="group" aria-label="Filter by category">${chips}</div>
        <div class="controls__meta">
          <span id="result-count"><b>${total}</b> shops</span>
          <button id="clear" class="btn-clear" type="button">Clear all filters</button>
        </div>
      </div>

      <div class="grid" id="grid">${cards}</div>
      <div class="empty" id="empty"><h3>No shops match your filters.</h3><p>Try clearing a filter or searching a different term.</p></div>
    </div>
  </section>
</main>
${footer('', meta)}
<script src="assets/app.js" defer></script>`;
}

/* ------------------------------------------------------------ detail page */
function detailPage(s, all, meta) {
  const tierLabel = TIER_LABEL[s.tier];
  const base = '../';
  const catText = s.categories.length
    ? ` specializing in ${joinList(s.categories.slice(0, 4))}` : '';
  const locText = s.region ? `, based in ${s.region}` : '';
  const decant = s.sellsDecants ? ' Offers decants for sampling.' : '';
  const lede = `<b>${esc(s.name)}</b> is a ${esc(tierLabel)} fragrance shop${esc(catText)}${esc(locText)}.${esc(decant)}`;

  const tags = s.categories.map((c) =>
    `<a class="tag" href="${base}index.html?cat=${encodeURIComponent(c)}">${esc(c)}</a>`).join(' ');

  // links
  const linkChips = s.links.map((url) => {
    const p = platformFromUrl(url);
    return `<a class="linkchip" href="${esc(url)}" target="_blank" rel="noopener">${platformIcon(p)} ${esc(p)} ${I.external}</a>`;
  }).join('');
  const platformOnly = s.platforms.filter((p) =>
    !s.links.some((u) => platformFromUrl(u).toLowerCase() === p.toLowerCase()));
  const presence = platformOnly.length
    ? `<p class="note-unavail">Also active on ${esc(platformOnly.join(', '))}.</p>` : '';
  const unavail = s.linkUnavailable ? `<p class="note-unavail">Note: a listed store link is marked currently unavailable on the source list.</p>` : '';

  const primary = s.storeLink
    ? `<a class="btn btn--gold" href="${esc(s.storeLink)}" target="_blank" rel="noopener" style="margin-bottom:1.4rem">Visit secured store <span class="btn__arrow">↗</span></a>` : '';

  // credential aside
  let aside;
  if (s.tier === 'preferred') {
    const st = validityStatus(s.validity);
    const rows = [];
    if (s.certificate) rows.push(`<div class="cred-row"><dt>Certificate No.</dt><dd>${esc(s.certificate)}</dd></div>`);
    if (s.validity) rows.push(`<div class="cred-row"><dt>Valid Until</dt><dd>${esc(s.validity)}${st ? ` <span class="status status--${st.cls}">${st.label}</span>` : ''}</dd></div>`);
    const docs = s.documents.length
      ? `<ul class="docs">${s.documents.map((d) => `<li>${I.check}<span>${esc(d)}</span></li>`).join('')}</ul>`
      : `<p class="advisory" style="margin-top:1rem">Recognized as a PFC-Preferred shop by the community.</p>`;
    const docsHead = s.documents.length ? `<p class="eyebrow" style="margin-top:1.4rem">Documents submitted</p>` : '';
    aside = `<aside class="credential">
      <div class="credential__seal">${I.seal}<h2>PFC-Preferred</h2><p>Certified Shop</p></div>
      <dl>${rows.join('') || '<p class="advisory">A certified PFC-Preferred shop.</p>'}</dl>
      ${docsHead}${docs}
      <p class="cred-foot">Issued by the Pinoy Fragheads Community. This listing reflects documents and information provided by the shop and does not constitute a guarantee, warranty, or assumption of liability.</p>
    </aside>`;
  } else {
    aside = `<aside class="credential credential--comm">
      <div class="credential__seal">${I.seal}<h2>Community</h2><p>Verified Link</p></div>
      <p class="advisory">This shop is <b>well-known within the community</b> and its link has been verified to belong to the stated store. PFC has not conducted internal review, transaction validation, or authenticity checks.</p>
      <p class="cred-foot">Not officially certified or endorsed as PFC-Preferred. Please exercise due diligence before transacting.</p>
    </aside>`;
  }

  // location block
  const locationBlock = s.hasPhysicalStore
    ? `<div class="dsection"><p class="eyebrow">Where to find them</p><div class="addr">${I.pin}<span>${esc(s.address)}${s.region ? `<br><span style="color:var(--gold)">${esc(s.region)}</span>` : ''}</span></div></div>`
    : `<div class="dsection"><p class="eyebrow">Where to find them</p><div class="addr">${I.globe}<span>Online shop — available through the links below.</span></div></div>`;

  // related (shared category, other shops)
  const related = all
    .filter((x) => x.id !== s.id && x.categories.some((c) => s.categories.includes(c)))
    .sort((a, b) => a.rank - b.rank).slice(0, 4)
    .map((x) => `<a href="${x.id}.html"><strong>${esc(x.name)}</strong><span>${esc(TIER_LABEL[x.tier])}${x.region ? ' · ' + esc(x.region) : ''}</span></a>`).join('');
  const relatedBlock = related
    ? `<section class="related"><div class="wrap"><p class="eyebrow">Kindred houses</p><div class="related__grid">${related}</div></div></section>`
    : '';

  const desc = `${s.name} — a ${tierLabel} fragrance shop${catText}${locText} on the PFC Master List.`;

  return `${pageHead(`${s.name} — PFC Master List`, desc, base, `shop/${s.id}.html`)}
${header(base)}
<main class="detail">
  <div class="wrap wrap--wide">
    <div class="detail__head">
      <a class="backlink" href="${base}index.html#register"><span class="btn__arrow">←</span> The Register</a>
      <p class="eyebrow" style="margin-top:1.6rem">${esc(tierLabel)}</p>
      <h1>${esc(s.name)}</h1>
      ${s.altNames.length ? `<div class="card__alt">also known as ${esc(s.altNames.join(' · '))}</div>` : ''}
      <div class="tags" style="margin-top:1.2rem">${tags}</div>
    </div>

    <div class="detail__layout">
      <div class="detail__main">
        <p class="dlede">${lede}</p>
        ${locationBlock}
        <div class="dsection">
          <p class="eyebrow">Shop &amp; connect</p>
          ${primary}
          <div class="linkrow">${linkChips}</div>
          ${presence}${unavail}
        </div>
      </div>
      ${aside}
    </div>
  </div>
  ${relatedBlock}
</main>
${footer(base, meta)}
<script src="${base}assets/app.js" defer></script>`;
}

/* ------------------------------------------------------------------ build */
const HEAD_MARK = '<!--/HEAD-->';
function rmrf(dir) { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

// Each page string is `<head content> <!--/HEAD--> <body content>`.
function writePage(file, inner) {
  const i = inner.indexOf(HEAD_MARK);
  const head = (i === -1 ? '' : inner.slice(0, i)).trim();
  const body = (i === -1 ? inner : inner.slice(i + HEAD_MARK.length)).trim();
  fs.writeFileSync(file,
    `<!doctype html>\n<html lang="en">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`, 'utf8');
}

function run() {
  const { meta, shops } = loadData(path.join(ROOT, 'data', 'master-list.csv'));
  // stable rank: preferred first, source order preserved
  shops.forEach((s, i) => { s.rank = (s.tier === 'preferred' ? 0 : 100000) + i; });
  const facets = buildFacets(shops);

  rmrf(OUT);
  ensure(path.join(OUT, 'shop'));
  ensure(path.join(OUT, 'assets'));
  ensure(path.join(OUT, 'data'));

  writePage(path.join(OUT, 'index.html'), indexPage(meta, shops, facets));
  for (const s of shops) writePage(path.join(OUT, 'shop', `${s.id}.html`), detailPage(s, shops, meta));

  fs.copyFileSync(path.join(ROOT, 'src', 'styles.css'), path.join(OUT, 'assets', 'styles.css'));
  fs.copyFileSync(path.join(ROOT, 'src', 'app.js'), path.join(OUT, 'assets', 'app.js'));

  fs.writeFileSync(path.join(OUT, 'data', 'shops.json'),
    JSON.stringify({ generated: buildDate.toISOString(), meta, shops }, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8'); // GitHub Pages: skip Jekyll

  writePage(path.join(OUT, '404.html'),
    `${pageHead('Not found — PFC Master List', 'Page not found.', '', '')}
${header('')}
<main class="detail"><div class="wrap" style="text-align:center;padding-block:6rem">
  <p class="eyebrow">404</p>
  <h1 style="font-family:var(--serif);font-size:clamp(2.5rem,6vw,4.5rem);font-weight:500;margin:1rem 0">This scent has evaporated.</h1>
  <p style="color:var(--muted);margin-bottom:2rem">The page you're looking for isn't here.</p>
  <a class="btn btn--gold" href="index.html">Back to the register</a>
</div></main>
${footer('', meta)}`);

  if (SITE_URL) {
    const urls = ['index.html', ...shops.map((s) => `shop/${s.id}.html`)]
      .map((u) => `  <url><loc>${SITE_URL}/${u}</loc></url>`).join('\n');
    fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'utf8');
  }

  console.log(`✓ Built ${shops.length} shops → ${path.relative(ROOT, OUT)}`);
  console.log(`  index.html · ${shops.length} detail pages · assets · shops.json`);
}

run();
