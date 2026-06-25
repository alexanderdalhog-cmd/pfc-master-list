# Shop logos

Drop a logo here and it appears automatically — no code changes needed.

## How
1. Name the file after the shop's **slug** (its detail-page filename, minus `.html`).
   Example: the page `docs/shop/regal-spritz.html` → logo file `regal-spritz.png`.
2. Allowed formats (first match wins): `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`.
3. Run `npm run build` (or `npm run update`). Shops with a logo show it; the rest
   show an elegant gold/silver **monogram** avatar.

## Tips
- Square images look best (they're shown in a 46px / 72px circle, `object-fit: cover`).
- Prefer a clean logo on a transparent or solid background, ≥128×128px.
- A full slug list is in `docs/data/shops.json` (each shop's `id`).

> Only add logos you have permission to use. This is an independent directory;
> shop logos remain the property of their respective owners.
