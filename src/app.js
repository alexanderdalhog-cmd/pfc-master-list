/* PFC · The Master List — progressive enhancement.
   Cards render server-side; this adds the theme toggle, mobile menu, sticky
   chrome, scroll reveals, hero count-ups, and live directory filtering with a
   smooth FLIP reorder. The site is fully usable (and indexable) with JS off. */

(() => {
  'use strict';
  const root = document.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => mqReduce.matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* --- polite live region for status announcements --- */
  let liveEl;
  const announce = (msg) => {
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.className = 'visually-hidden';
      liveEl.setAttribute('aria-live', 'polite');
      liveEl.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveEl);
    }
    liveEl.textContent = '';
    setTimeout(() => { liveEl.textContent = msg; }, 50);
  };

  /* --- theme: system / light / dark --- */
  (() => {
    const btn = $('.theme-toggle');
    const meta = document.getElementById('theme-color');
    const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    const ORDER = ['system', 'light', 'dark'];
    const LABEL = { system: 'System', light: 'Light', dark: 'Dark' };
    const isDark = (mode) => mode === 'dark' || (mode === 'system' && mqDark.matches);
    const paintMeta = (mode) => { if (meta) meta.setAttribute('content', isDark(mode) ? '#0C0B09' : '#F6F1E7'); };

    const apply = (mode, animate) => {
      if (animate && !reduceMotion()) {
        root.classList.add('theme-anim');
        setTimeout(() => root.classList.remove('theme-anim'), 420);
      }
      root.setAttribute('data-theme-mode', mode);
      if (mode === 'system') { root.removeAttribute('data-theme'); try { localStorage.removeItem('pfc-theme'); } catch (e) {} }
      else { root.setAttribute('data-theme', mode); try { localStorage.setItem('pfc-theme', mode); } catch (e) {} }
      root.style.colorScheme = isDark(mode) ? 'dark' : 'light';
      paintMeta(mode);
      if (btn) btn.setAttribute('aria-label', `Theme: ${LABEL[mode]}. Activate to switch.`);
    };

    if (btn) {
      let mode = root.getAttribute('data-theme-mode') || 'system';
      btn.setAttribute('aria-label', `Theme: ${LABEL[mode]}. Activate to switch.`);
      btn.addEventListener('click', () => {
        mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
        apply(mode, true);
        announce(`${LABEL[mode]} theme`);
      });
    }
    // follow the OS when in system mode
    mqDark.addEventListener('change', () => {
      if ((root.getAttribute('data-theme-mode') || 'system') === 'system') {
        root.style.colorScheme = mqDark.matches ? 'dark' : 'light';
        paintMeta('system');
      }
    });
  })();

  /* --- mobile menu --- */
  (() => {
    const toggle = $('.nav__toggle');
    const nav = $('#nav-menu');
    if (!toggle || !nav) return;
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  })();

  /* --- sticky header (rAF-throttled, dirty-checked) --- */
  (() => {
    const head = $('.site-head');
    if (!head) return;
    let stuck = false, ticking = false;
    const update = () => { const s = window.scrollY > 24; if (s !== stuck) { stuck = s; head.classList.toggle('is-stuck', s); } ticking = false; };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* --- scroll reveal --- */
  const reveals = $$('.reveal');
  if (reveals.length && !reduceMotion() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const idx = reveals.indexOf(e.target);
        e.target.style.transitionDelay = `${Math.min((idx % 12) * 45, 250)}ms`;
        e.target.classList.add('in');
        e.target.addEventListener('transitionend', () => { e.target.style.transitionDelay = ''; }, { once: true });
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* --- hero stat count-up --- */
  const counters = $$('[data-count]');
  if (counters.length) {
    const fmt = (n) => n.toLocaleString('en-US');
    const run = (el) => {
      const target = +el.dataset.count;
      if (reduceMotion()) { el.textContent = fmt(target); return; }
      const dur = 1100, start = performance.now();
      let last = -1;
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const val = Math.round((1 - Math.pow(1 - p, 3)) * target);
        if (val !== last) { el.textContent = fmt(val); last = val; }
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
      counters.forEach((el) => io.observe(el));
    } else counters.forEach(run);
  }

  /* ============================ DIRECTORY FILTERING (index only) ======== */
  const grid = $('#grid');
  if (!grid) return;

  const cards = $$('.card-link', grid);
  const searchEl = $('#search');
  const tierBtns = $$('[data-tier]');
  const chipWrap = $('#chips');
  const regionEl = $('#region');
  const sortEl   = $('#sort');
  const countEl  = $('#result-count');
  const emptyEl  = $('#empty');
  const clearEl  = $('#clear');

  const TIERS = ['all', 'preferred', 'community'];
  const SORTS = ['featured', 'az', 'za'];
  const regionValues = regionEl ? $$('option', regionEl).map((o) => o.value) : ['all'];
  const allCats = new Set(cards.flatMap((c) => (c.dataset.cats || '').split('|').filter(Boolean)));

  const state = { q: '', tier: 'all', cats: new Set(), region: 'all', sort: 'featured' };

  /* hydrate from URL, validated against real options */
  const params = new URLSearchParams(location.search);
  if (params.get('q')) state.q = params.get('q');
  if (TIERS.includes(params.get('tier'))) state.tier = params.get('tier');
  if (regionValues.includes(params.get('region'))) state.region = params.get('region');
  if (SORTS.includes(params.get('sort'))) state.sort = params.get('sort');
  if (params.get('cat')) params.get('cat').split('|').filter(Boolean).forEach((c) => { if (allCats.has(c)) state.cats.add(c); });

  /* ensure a chip exists for every active category (incl. long-tail ones that
     are below the default chip threshold) so the filter is always visible/clearable */
  if (chipWrap) {
    state.cats.forEach((cat) => {
      if (!chipWrap.querySelector(`[data-cat="${CSS.escape(cat)}"]`)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.dataset.cat = cat; b.setAttribute('aria-pressed', 'true');
        b.textContent = cat;
        chipWrap.appendChild(b);
      }
    });
  }
  const catChips = $$('[data-cat]');

  if (searchEl) searchEl.value = state.q;
  if (regionEl) regionEl.value = state.region;
  if (sortEl) sortEl.value = state.sort;
  tierBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tier === state.tier)));
  catChips.forEach((c) => c.setAttribute('aria-pressed', String(state.cats.has(c.dataset.cat))));

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
      const cc = d.cats.split('|');
      if (![...state.cats].some((c) => cc.includes(c))) return false;
    }
    if (state.q) { const q = state.q.toLowerCase().trim(); if (q && !d.search.includes(q)) return false; }
    return true;
  };

  const CMP = {
    az: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
    za: (a, b) => b.dataset.name.localeCompare(a.dataset.name),
    featured: (a, b) => (a.dataset.rank - b.dataset.rank) || a.dataset.name.localeCompare(b.dataset.name),
  };
  let lastSort = state.sort;

  const apply = () => {
    const animate = !reduceMotion();
    // FLIP: record positions of currently-visible cards before mutating
    const firsts = animate ? new Map() : null;
    if (animate) cards.forEach((c) => { if (!c.classList.contains('hidden')) firsts.set(c, c.getBoundingClientRect()); });

    let shown = 0; const visible = [];
    cards.forEach((card) => {
      const ok = matches(card);
      card.classList.toggle('hidden', !ok);
      if (ok) { shown++; visible.push(card); card.classList.add('in'); card.style.transitionDelay = ''; }
    });

    // reorder the DOM only when the sort actually changed (batch via fragment)
    if (state.sort !== lastSort) {
      const frag = document.createDocumentFragment();
      visible.sort(CMP[state.sort] || CMP.featured).forEach((c) => frag.appendChild(c));
      grid.appendChild(frag);
      lastSort = state.sort;
    }

    // FLIP play: animate moved cards from old → new position
    if (animate) {
      requestAnimationFrame(() => {
        visible.forEach((card) => {
          const first = firsts.get(card);
          if (!first) return; // newly shown — appears in place
          const last = card.getBoundingClientRect();
          const dx = first.left - last.left, dy = first.top - last.top;
          if (!dx && !dy) return;
          card.style.transition = 'none';
          card.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            card.style.transition = `transform var(--dur-base) var(--ease)`;
            card.style.transform = '';
            card.addEventListener('transitionend', () => { card.style.transition = ''; }, { once: true });
          });
        });
      });
    }

    if (countEl) countEl.textContent = shown === 1 ? '1 shop' : `${shown} shops`;
    if (emptyEl) emptyEl.classList.toggle('show', shown === 0);
    syncURL();
  };

  /* events */
  if (searchEl) {
    let t;
    searchEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = searchEl.value; apply(); }, 120); });
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
  if (sortEl) sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(); });
  if (clearEl) clearEl.addEventListener('click', () => {
    state.q = ''; state.tier = 'all'; state.cats.clear(); state.region = 'all';
    if (searchEl) searchEl.value = '';
    if (regionEl) regionEl.value = 'all';
    tierBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tier === 'all')));
    catChips.forEach((x) => x.setAttribute('aria-pressed', 'false'));
    apply();
  });

  apply();
})();
