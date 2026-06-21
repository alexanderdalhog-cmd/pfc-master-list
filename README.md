# The Master List — Pinoy Fragheads

An independent, connoisseur-grade web directory of trusted Philippine fragrance
shops, sourced from the **Pinoy Fragheads Community (PFC) Official Master List**.
Static, fast, and dependency-free — it drops straight into GitHub Pages.

> **Independent project.** Data is sourced from the PFC Master List. This site is
> not officially affiliated with, endorsed by, or operated by PFC. Inclusion is
> not a guarantee or warranty — always practice due diligence before you buy.

---

## What it does

- **Two tiers, clearly distinguished** — *PFC-Preferred* (documents verified,
  certificate on file) and *Community-Verified* (known, link-verified).
- **A filterable register** — instant search + filters for category, tier, and
  location, with shareable filtered URLs (e.g. `?tier=preferred&cat=Decants`).
- **A page per shop** — categories, location, store + social links, and for
  Preferred shops a "credential" panel showing the certificate number, validity
  status, and the exact documents submitted.
- **Noir & gold design** — Cormorant Garamond + Inter, warm near-black canvas,
  champagne-gold detailing. Fully responsive and accessible.

## Project layout

```
data/master-list.csv     ← snapshot of the Google Sheet (the source of truth)
src/styles.css           ← the design system
src/app.js               ← progressive-enhancement filtering
scripts/lib/data.mjs     ← CSV → clean shop model
scripts/build.mjs        ← generates the static site into /docs
scripts/refresh.mjs      ← re-pulls the latest sheet into data/master-list.csv
docs/                    ← the built site (this is what GitHub Pages serves)
```

The site is generated, not hand-edited. **Edit `src/`, `data/`, or `scripts/` —
never `docs/` directly** (it is overwritten on every build).

## Updating the shops

The data is baked in at build time. When the Google Sheet changes:

```bash
npm run update      # re-pull the sheet + rebuild  (= refresh + build)
```

Or step by step:

```bash
npm run refresh     # download the latest sheet → data/master-list.csv
npm run build       # regenerate docs/
```

To work entirely offline, just edit `data/master-list.csv` and run `npm run build`.

## Preview locally

```bash
npm run preview     # build + serve docs/ on a local port
# — or simply open docs/index.html in your browser
```

## Deploy on GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_.**
3. Choose branch `main` and folder **`/docs`**, then **Save**.
4. Your site goes live at `https://<username>.github.io/<repo>/` in a minute or two.

All internal links are relative, so it works under any sub-path without changes.
(Optional: set `SITE_URL` at the top of `scripts/build.mjs` to your live URL to
emit a `sitemap.xml` and canonical/Open-Graph URLs.)

## Customizing

- **Brand mood** — every color and font is a CSS variable at the top of
  `src/styles.css`.
- **PFC social links** — replace the three `placeholder-link` entries in the
  footer (`scripts/build.mjs`) with the real PFC Facebook / TikTok / Instagram URLs.
- **Copy** — the hero, mission, and tier descriptions live in `indexPage()` in
  `scripts/build.mjs`. The mission text is pulled live from the sheet where present.

---

*Gawin nating mabango ang Pilipinas — one Filipino at a time.* ✦
