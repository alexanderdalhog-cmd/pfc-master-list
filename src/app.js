/* PFC · The Master List — progressive enhancement.
   Cards are rendered server-side; this script layers on sticky chrome,
   scroll reveals, hero count-ups, and the live directory filtering. The
   site is fully usable (and indexable) with JavaScript disabled. */

(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* --- sticky header --- */
  const head = $('.site-head');
  if (head) {
    const onScroll = () => head.classList.toggle('is-stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- scroll reveal --- */
  const reveals = $$('.reveal');
  if (reveals.length && !reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = `${Math.min(i * 60, 240)}ms`;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* --- hero stat count-up --- */
  const counters = $$('[data-count]');
  if (counters.length) {
    const run = (el) => {
      const target = +el.dataset.count;
      if (reduceMotion) { el.textContent = target; return; }
      const dur = 1100; const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * target);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      }), { threshold: 0.6 });
      counters.forEach((el) => io.observe(el));
    } else counters.forEach(run);
  }

  /* ============================ DIRECTORY FILTERING (index only) ======== */
  const grid = $('#grid');
  if (!grid) return;

  const cards = $$('.card-link', grid);
  const searchEl = $('#search');
  const tierBtns = $$('[data-tier]');
  const catChips = $$('[data-cat]');
  const regionEl = $('#region');
  const sortEl   = $('#sort');
  const countEl  = $('#result-count');
  const emptyEl  = $('#empty');
  const clearEl  = $('#clear');

  const state = { q: '', tier: 'all', cats: new Set(), region: 'all', sort: 'featured' };

  /* hydrate from URL so filtered views are shareable */
  const params = new URLSearchParams(location.search);
  if (params.get('q'))      { state.q = params.get('q'); if (searchEl) searchEl.value = state.q; }
  if (params.get('tier'))   state.tier = params.get('tier');
  if (params.get('region')) state.region = params.get('region');
  if (params.get('sort'))   state.sort = params.get('sort');
  if (params.get('cat'))    params.get('cat').split('|').filter(Boolean).forEach((c) => state.cats.add(c));

  const syncURL = () => {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.tier !== 'all') p.set('tier', state.tier);
    if (state.region !== 'all') p.set('region', state.region);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    if (state.cats.size) p.set('cat', [...state.cats].join('|'));
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  };

  const matches = (card) => {
    const d = card.dataset;
    if (state.tier !== 'all' && d.tier !== state.tier) return false;
    if (state.region !== 'all') {
      if (state.region === '__online') { if (d.store === '1') return false; }
      else if (d.region !== state.region) return false;
    }
    if (state.cats.size) {
      const cardCats = d.cats.split('|');
      if (![...state.cats].some((c) => cardCats.includes(c))) return false;
    }
    if (state.q) {
      const q = state.q.toLowerCase().trim();
      if (q && !d.search.includes(q)) return false;
    }
    return true;
  };

  const apply = () => {
    let shown = 0;
    const visible = [];
    cards.forEach((card) => {
      const ok = matches(card);
      card.classList.toggle('hidden', !ok);
      if (ok) { shown++; visible.push(card); }
    });

    /* sort the visible set */
    const cmp = {
      'az':       (a, b) => a.dataset.name.localeCompare(b.dataset.name),
      'za':       (a, b) => b.dataset.name.localeCompare(a.dataset.name),
      'featured': (a, b) => (a.dataset.rank - b.dataset.rank) || a.dataset.name.localeCompare(b.dataset.name),
    }[state.sort] || (() => 0);
    visible.sort(cmp).forEach((c) => grid.appendChild(c));

    if (countEl) countEl.innerHTML = `<b>${shown}</b> ${shown === 1 ? 'shop' : 'shops'}`;
    if (emptyEl) emptyEl.classList.toggle('show', shown === 0);
    syncURL();
  };

  /* reflect hydrated state into the controls */
  tierBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tier === state.tier)));
  catChips.forEach((c) => c.setAttribute('aria-pressed', String(state.cats.has(c.dataset.cat))));
  if (regionEl) regionEl.value = state.region;
  if (sortEl)   sortEl.value = state.sort;

  /* wire events */
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = searchEl.value; apply(); }, 120);
    });
  }
  tierBtns.forEach((b) => b.addEventListener('click', () => {
    state.tier = b.dataset.tier;
    tierBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    apply();
  }));
  catChips.forEach((c) => c.addEventListener('click', () => {
    const cat = c.dataset.cat;
    if (state.cats.has(cat)) state.cats.delete(cat); else state.cats.add(cat);
    c.setAttribute('aria-pressed', String(state.cats.has(cat)));
    apply();
  }));
  if (regionEl) regionEl.addEventListener('change', () => { state.region = regionEl.value; apply(); });
  if (sortEl)   sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(); });
  if (clearEl)  clearEl.addEventListener('click', () => {
    state.q = ''; state.tier = 'all'; state.cats.clear(); state.region = 'all'; state.sort = 'featured';
    if (searchEl) searchEl.value = '';
    if (regionEl) regionEl.value = 'all';
    if (sortEl) sortEl.value = 'featured';
    tierBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tier === 'all')));
    catChips.forEach((x) => x.setAttribute('aria-pressed', 'false'));
    apply();
  });

  apply();
})();
