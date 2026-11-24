(() => {
  'use strict';

  const DEFAULT_SETTINGS = {
    theme: 'system',       // 'light' | 'dark' | 'system'
    style: 'mushaf',       // 'mushaf' | 'modern' | 'minimal'
    fontSize: 28,          // 18..46
    lineHeight: 2.15,      // 1.6..2.8
    align: 'justify',      // 'justify' | 'right' | 'center'
    width: 'comfortable'   // 'compact' | 'comfortable' | 'wide'
  };

  const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const toAr = (n) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[d]);

  const normalizeSearch = (str) =>
    str
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim()
      .toLowerCase();

  const state = {
    data: null,
    settings: { ...DEFAULT_SETTINGS },
    marker: null,          // { surah: number, verse: number, page: number, juz: number, savedAt: number }
    currentSurahId: 1,
    activeMenuTarget: null, // { surah: number, verse: number, page: number, juz: number, text: string }
    toastTimer: null,
    longPressTimer: null,
    pointerStart: null,
    longPressTriggered: false,
    pageIndexMap: null     // page -> { surah, verse }
  };

  // DOM References
  const $ = (id) => document.getElementById(id);
  const dom = {
    progressFill: $('progressFill'),
    metaThemeColor: $('metaThemeColor'),
    headerSurahName: $('headerSurahName'),
    headerMeta: $('headerMeta'),
    btnOpenNav: $('btnOpenNav'),
    btnSurahTitle: $('btnSurahTitle'),
    btnContinueTop: $('btnContinueTop'),
    continueTopLabel: $('continueTopLabel'),
    btnQuickStyle: $('btnQuickStyle'),
    btnOpenSettings: $('btnOpenSettings'),
    btnMinimalControls: $('btnMinimalControls'),
    continueBanner: $('continueBanner'),
    continueBannerTitle: $('continueBannerTitle'),
    btnContinueBannerGo: $('btnContinueBannerGo'),
    btnContinueBannerClose: $('btnContinueBannerClose'),
    loadingState: $('loadingState'),
    surahContainer: $('surahContainer'),
    surahTitle: $('surahTitle'),
    surahSubtitle: $('surahSubtitle'),
    basmalahEl: $('basmalahEl'),
    versesStage: $('versesStage'),
    btnPrevSurah: $('btnPrevSurah'),
    btnNextSurah: $('btnNextSurah'),
    prevSurahName: $('prevSurahName'),
    nextSurahName: $('nextSurahName'),
    backdrop: $('backdrop'),
    navDrawer: $('navDrawer'),
    btnCloseNav: $('btnCloseNav'),
    surahSearch: $('surahSearch'),
    surahList: $('surahList'),
    juzList: $('juzList'),
    drawerMarkerShortcut: $('drawerMarkerShortcut'),
    btnDrawerGoMarker: $('btnDrawerGoMarker'),
    drawerMarkerText: $('drawerMarkerText'),
    jumpSurah: $('jumpSurah'),
    jumpVerse: $('jumpVerse'),
    jumpVerseMax: $('jumpVerseMax'),
    btnJumpVerseGo: $('btnJumpVerseGo'),
    jumpPage: $('jumpPage'),
    btnJumpPageGo: $('btnJumpPageGo'),
    settingsDrawer: $('settingsDrawer'),
    btnCloseSettings: $('btnCloseSettings'),
    segTheme: $('segTheme'),
    segStyle: $('segStyle'),
    rangeFontSize: $('rangeFontSize'),
    valFontSize: $('valFontSize'),
    rangeLineHeight: $('rangeLineHeight'),
    valLineHeight: $('valLineHeight'),
    segAlign: $('segAlign'),
    segWidth: $('segWidth'),
    offlineStatusText: $('offlineStatusText'),
    btnResetSettings: $('btnResetSettings'),
    verseMenu: $('verseMenu'),
    verseMenuHeader: $('verseMenuHeader'),
    menuSetMarker: $('menuSetMarker'),
    menuRemoveMarker: $('menuRemoveMarker'),
    menuGoMarker: $('menuGoMarker'),
    menuCopyVerse: $('menuCopyVerse'),
    toast: $('toast')
  };

  /* ==================== Toast ==================== */
  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2300);
  }

  /* ==================== Theme & Settings ==================== */
  const mediaDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme() {
    const mode = state.settings.theme;
    const isDark = mode === 'dark' || (mode === 'system' && mediaDark.matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    dom.metaThemeColor.setAttribute('content', isDark ? '#171D1B' : '#174D3E');
  }

  function applySettingsToDOM(preservePosition = false) {
    const anchorVerse = preservePosition ? getTopVisibleVerseNumber() : null;

    applyTheme();
    document.documentElement.style.setProperty('--quran-size', `${state.settings.fontSize}px`);
    document.documentElement.style.setProperty('--quran-lh', String(state.settings.lineHeight));
    document.documentElement.style.setProperty('--quran-align', state.settings.align);

    document.body.classList.remove('style-mushaf', 'style-modern', 'style-minimal', 'minimal-show-ui');
    document.body.classList.add(`style-${state.settings.style}`);

    document.body.classList.remove('width-compact', 'width-comfortable', 'width-wide');
    document.body.classList.add(`width-${state.settings.width}`);

    // Sync controls
    syncSegmented(dom.segTheme, state.settings.theme);
    syncSegmented(dom.segStyle, state.settings.style);
    syncSegmented(dom.segAlign, state.settings.align);
    syncSegmented(dom.segWidth, state.settings.width);
    dom.rangeFontSize.value = state.settings.fontSize;
    dom.valFontSize.textContent = `${state.settings.fontSize}px`;
    dom.rangeLineHeight.value = state.settings.lineHeight;
    dom.valLineHeight.textContent = Number(state.settings.lineHeight).toFixed(1);

    if (preservePosition && state.data) {
      renderSurah(state.currentSurahId, anchorVerse, false);
    }
  }

  function syncSegmented(container, val) {
    container.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.val === val);
    });
  }

  async function saveSettings() {
    await QuranDB.setSettings(state.settings);
  }

  function getTopVisibleVerseNumber() {
    const nodes = dom.versesStage.querySelectorAll('[data-verse]');
    const threshold = 90;
    for (let i = 0; i < nodes.length; i++) {
      const rect = nodes[i].getBoundingClientRect();
      if (rect.bottom >= threshold) {
        return Number(nodes[i].dataset.verse);
      }
    }
    return 1;
  }

  /* ==================== Reading Marker (Permanent) ==================== */
  function updateMarkerUI() {
    const m = state.marker;
    if (!m || !state.data) {
      dom.btnContinueTop.classList.add('hidden');
      dom.continueBanner.classList.add('hidden');
      dom.drawerMarkerShortcut.classList.add('hidden');
      return;
    }
    const surah = state.data.surahs[m.surah - 1];
    const label = `${surah.name} · الآية ${toAr(m.verse)}`;
    dom.continueTopLabel.textContent = `متابعة: ${surah.name} (${toAr(m.verse)})`;
    dom.btnContinueTop.classList.remove('hidden');
    dom.continueBannerTitle.textContent = `${label} · ص ${toAr(m.page)}`;
    dom.drawerMarkerText.textContent = `علامة التوقف: ${label}`;
    dom.drawerMarkerShortcut.classList.remove('hidden');
  }

  function applyMarkerHighlightInDOM() {
    dom.versesStage.querySelectorAll('.is-marked').forEach((el) => {
      el.classList.remove('is-marked');
      const chip = el.querySelector('.marked-chip');
      if (chip) chip.remove();
    });
    if (!state.marker || state.marker.surah !== state.currentSurahId) return;
    const target = dom.versesStage.querySelector(`[data-verse="${state.marker.verse}"]`);
    if (target) {
      target.classList.add('is-marked');
      if (state.settings.style === 'modern') {
        const meta = target.querySelector('.verse-card-meta');
        if (meta && !meta.querySelector('.marked-chip')) {
          const chip = document.createElement('span');
          chip.className = 'marked-chip';
          chip.textContent = '⚑ علامة التوقف';
          meta.appendChild(chip);
        }
      }
    }
  }

  async function setReadingMarker(surahId, verseNum, page, juz) {
    state.marker = { surah: surahId, verse: verseNum, page, juz, savedAt: Date.now() };
    await QuranDB.setMarker(state.marker);
    applyMarkerHighlightInDOM();
    updateMarkerUI();
    const sName = state.data.surahs[surahId - 1].name;
    showToast(`تم حفظ علامة التوقف: ${sName} — الآية ${toAr(verseNum)}`);
  }

  async function removeReadingMarker() {
    state.marker = null;
    await QuranDB.clearMarker();
    applyMarkerHighlightInDOM();
    updateMarkerUI();
    showToast('تمت إزالة علامة التوقف');
  }

  function goToMarker() {
    if (!state.marker) return;
    dom.continueBanner.classList.add('hidden');
    closeAllDrawers();
    openSurah(state.marker.surah, state.marker.verse, true);
  }

  /* ==================== Rendering ==================== */
  function openSurah(surahId, targetVerse = null, pulse = false) {
    const id = Math.max(1, Math.min(114, Number(surahId)));
    state.currentSurahId = id;
    QuranDB.setLastView({ surah: id });
    renderSurah(id, targetVerse, pulse);
    highlightActiveSurahInDrawer();
  }

  function renderSurah(surahId, targetVerse = null, pulse = false) {
    const surah = state.data.surahs[surahId - 1];
    dom.headerSurahName.textContent = surah.name;
    const firstV = surah.verses[0];
    dom.headerMeta.textContent = `الجزء ${toAr(firstV.j)} · ص ${toAr(firstV.p)}`;

    dom.surahTitle.textContent = surah.name;
    const typeLabel = surah.type === 'medinan' ? 'مدنية' : 'مكية';
    dom.surahSubtitle.textContent = `${typeLabel} · ${toAr(surah.count)} آيات · ص ${toAr(surah.startPage)}`;

    if (surah.basmalah) {
      dom.basmalahEl.textContent = surah.basmalah;
      dom.basmalahEl.classList.remove('hidden');
    } else {
      dom.basmalahEl.classList.add('hidden');
    }

    // Previous / Next Surah buttons
    if (surahId > 1) {
      dom.btnPrevSurah.disabled = false;
      dom.prevSurahName.textContent = state.data.surahs[surahId - 2].name;
    } else {
      dom.btnPrevSurah.disabled = true;
      dom.prevSurahName.textContent = 'بداية المصحف';
    }
    if (surahId < 114) {
      dom.btnNextSurah.disabled = false;
      dom.nextSurahName.textContent = state.data.surahs[surahId].name;
    } else {
      dom.btnNextSurah.disabled = true;
      dom.nextSurahName.textContent = 'ختام المصحف';
    }

    // Build DOM using DocumentFragment for high performance on low-end Android
    const frag = document.createDocumentFragment();
    const style = state.settings.style;

    if (style === 'mushaf') {
      // Group verses by Madinah Mushaf page
      const pages = [];
      let curPageObj = null;
      for (let i = 0; i < surah.verses.length; i++) {
        const v = surah.verses[i];
        if (!curPageObj || curPageObj.page !== v.p) {
          curPageObj = { page: v.p, juz: v.j, verses: [] };
          pages.push(curPageObj);
        }
        curPageObj.verses.push(v);
      }

      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pg = pages[pIdx];
        const section = document.createElement('section');
        section.className = 'mushaf-page';
        section.dataset.page = pg.page;

        const body = document.createElement('div');
        body.className = 'mushaf-page-body';

        for (let i = 0; i < pg.verses.length; i++) {
          body.appendChild(createInlineVerseNode(surah.id, pg.verses[i]));
          body.appendChild(document.createTextNode(' '));
        }

        const footer = document.createElement('div');
        footer.className = 'mushaf-page-footer';
        footer.innerHTML = `<span>الجزء ${toAr(pg.juz)}</span><span>صفحة ${toAr(pg.page)}</span>`;

        section.appendChild(body);
        section.appendChild(footer);
        frag.appendChild(section);
      }
    } else if (style === 'modern') {
      for (let i = 0; i < surah.verses.length; i++) {
        const v = surah.verses[i];
        const card = document.createElement('div');
        card.className = 'verse-card';
        card.dataset.surah = surah.id;
        card.dataset.verse = v.n;
        card.dataset.page = v.p;
        card.dataset.juz = v.j;

        const pText = document.createElement('p');
        pText.className = 'verse-card-text';
        pText.textContent = v.t;
        if (v.s) {
          const sj = document.createElement('span');
          sj.className = 'sajdah-mark';
          sj.title = 'آية سجدة';
          sj.textContent = ' ۩';
          pText.appendChild(sj);
        }

        const meta = document.createElement('div');
        meta.className = 'verse-card-meta';
        meta.innerHTML = `<span class="verse-card-badge">الآية ${toAr(v.n)}${v.s ? ' · سجدة ۩' : ''}</span><span>الجزء ${toAr(v.j)} · ص ${toAr(v.p)}</span>`;

        card.appendChild(pText);
        card.appendChild(meta);
        frag.appendChild(card);
      }
    } else {
      // Minimal focus mode
      const flow = document.createElement('div');
      flow.className = 'minimal-flow';
      for (let i = 0; i < surah.verses.length; i++) {
        flow.appendChild(createInlineVerseNode(surah.id, surah.verses[i]));
        flow.appendChild(document.createTextNode(' '));
      }
      frag.appendChild(flow);
    }

    dom.versesStage.innerHTML = '';
    dom.versesStage.appendChild(frag);
    applyMarkerHighlightInDOM();

    if (targetVerse) {
      requestAnimationFrame(() => scrollToVerse(targetVerse, pulse));
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      updateScrollIndicators();
    }
  }

  function createInlineVerseNode(surahId, v) {
    const span = document.createElement('span');
    span.className = 'verse-inline';
    span.dataset.surah = surahId;
    span.dataset.verse = v.n;
    span.dataset.page = v.p;
    span.dataset.juz = v.j;

    span.appendChild(document.createTextNode(v.t));
    if (v.s) {
      const sj = document.createElement('span');
      sj.className = 'sajdah-mark';
      sj.title = 'آية سجدة';
      sj.textContent = '۩';
      span.appendChild(sj);
    }

    const num = document.createElement('span');
    num.className = 'ayah-end';
    num.textContent = toAr(v.n);
    span.appendChild(num);

    return span;
  }

  function scrollToVerse(verseNum, pulse = false) {
    const el = dom.versesStage.querySelector(`[data-verse="${verseNum}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const topOffset = window.scrollY + rect.top - 96;
    window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
    if (pulse) {
      el.classList.remove('verse-pulse');
      void el.offsetWidth;
      el.classList.add('verse-pulse');
    }
    setTimeout(updateScrollIndicators, 300);
  }

  /* ==================== Long-Press & Contextual Menu ==================== */
  function findVerseEl(node) {
    return node && node.closest ? node.closest('[data-verse]') : null;
  }

  function openVerseMenu(verseEl, clientX, clientY) {
    const surahId = Number(verseEl.dataset.surah);
    const verseNum = Number(verseEl.dataset.verse);
    const page = Number(verseEl.dataset.page);
    const juz = Number(verseEl.dataset.juz);
    const surah = state.data.surahs[surahId - 1];
    const verseObj = surah.verses[verseNum - 1];

    state.activeMenuTarget = { surah: surahId, verse: verseNum, page, juz, text: verseObj.t };

    dom.verseMenuHeader.textContent = `${surah.name} · الآية ${toAr(verseNum)} (ص ${toAr(page)})`;

    const isSameAsMarker = state.marker && state.marker.surah === surahId && state.marker.verse === verseNum;
    dom.menuSetMarker.classList.toggle('hidden', Boolean(isSameAsMarker));
    dom.menuRemoveMarker.classList.toggle('hidden', !isSameAsMarker);
    dom.menuGoMarker.classList.toggle('hidden', !state.marker || Boolean(isSameAsMarker));

    dom.verseMenu.classList.remove('hidden');

    // Position safely inside viewport
    const mw = dom.verseMenu.offsetWidth || 240;
    const mh = dom.verseMenu.offsetHeight || 180;
    const pad = 12;
    let x = clientX - mw / 2;
    let y = clientY - mh - 14;
    if (y < pad) y = clientY + 18;
    x = Math.max(pad, Math.min(window.innerWidth - mw - pad, x));
    y = Math.max(pad, Math.min(window.innerHeight - mh - pad, y));

    dom.verseMenu.style.left = `${x}px`;
    dom.verseMenu.style.top = `${y}px`;

    if (navigator.vibrate) {
      try { navigator.vibrate(22); } catch (_) {}
    }
  }

  function closeVerseMenu() {
    dom.verseMenu.classList.add('hidden');
    state.activeMenuTarget = null;
  }

  function clearLongPress() {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    state.pointerStart = null;
  }

  function bindVerseGestures() {
    const stage = dom.versesStage;

    // Touch & Mouse Long-Press (scroll-safe: cancels if moved > 10px)
    stage.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return; // handled by contextmenu
      const verseEl = findVerseEl(e.target);
      if (!verseEl) return;

      closeVerseMenu();
      state.longPressTriggered = false;
      state.pointerStart = { x: e.clientX, y: e.clientY };

      state.longPressTimer = setTimeout(() => {
        state.longPressTriggered = true;
        openVerseMenu(verseEl, e.clientX, e.clientY);
      }, 480);
    }, { passive: true });

    stage.addEventListener('pointermove', (e) => {
      if (!state.pointerStart) return;
      const dx = Math.abs(e.clientX - state.pointerStart.x);
      const dy = Math.abs(e.clientY - state.pointerStart.y);
      if (dx > 10 || dy > 10) {
        clearLongPress();
      }
    }, { passive: true });

    stage.addEventListener('pointerup', clearLongPress, { passive: true });
    stage.addEventListener('pointercancel', clearLongPress, { passive: true });

    // Desktop right-click & mobile native contextmenu suppression on verses
    stage.addEventListener('contextmenu', (e) => {
      const verseEl = findVerseEl(e.target);
      if (!verseEl) return;
      e.preventDefault();
      clearLongPress();
      openVerseMenu(verseEl, e.clientX, e.clientY);
    });

    // Close menu on outside tap or scroll
    document.addEventListener('pointerdown', (e) => {
      if (!dom.verseMenu.classList.contains('hidden') && !dom.verseMenu.contains(e.target)) {
        closeVerseMenu();
      }
    });
    window.addEventListener('scroll', closeVerseMenu, { passive: true });

    // Menu Actions
    dom.menuSetMarker.addEventListener('click', () => {
      if (!state.activeMenuTarget) return;
      const { surah, verse, page, juz } = state.activeMenuTarget;
      closeVerseMenu();
      setReadingMarker(surah, verse, page, juz);
    });

    dom.menuRemoveMarker.addEventListener('click', () => {
      closeVerseMenu();
      removeReadingMarker();
    });

    dom.menuGoMarker.addEventListener('click', () => {
      closeVerseMenu();
      goToMarker();
    });

    dom.menuCopyVerse.addEventListener('click', async () => {
      if (!state.activeMenuTarget) return;
      const t = state.activeMenuTarget;
      const sName = state.data.surahs[t.surah - 1].name;
      const formatted = `${t.text} ﴿${toAr(t.verse)}﴾ [${sName}]`;
      closeVerseMenu();
      try {
        await navigator.clipboard.writeText(formatted);
        showToast('تم نسخ الآية');
      } catch (_) {
        showToast('تعذّر النسخ التلقائي');
      }
    });
  }

  /* ==================== Navigation Index (Surahs / Juz / Jump) ==================== */
  function buildNavigationIndexes() {
    // 1. Build pageIndexMap (first verse on each page 1..604)
    state.pageIndexMap = {};
    for (const s of state.data.surahs) {
      for (const v of s.verses) {
        if (!state.pageIndexMap[v.p]) {
          state.pageIndexMap[v.p] = { surah: s.id, verse: v.n };
        }
      }
    }

    // 2. Render Surah list
    renderSurahList('');

    // 3. Render Juz list
    const jFrag = document.createDocumentFragment();
    state.data.juz.forEach((j) => {
      const s = state.data.surahs[j.surah - 1];
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'index-item';
      btn.innerHTML = `
        <span class="index-num">${toAr(j.id)}</span>
        <span class="index-main">
          <span class="index-title">الجزء ${toAr(j.id)}</span>
          <span class="index-sub">${s.name} · الآية ${toAr(j.verse)}</span>
        </span>
      `;
      btn.addEventListener('click', () => {
        closeAllDrawers();
        openSurah(j.surah, j.verse, true);
      });
      li.appendChild(btn);
      jFrag.appendChild(li);
    });
    dom.juzList.innerHTML = '';
    dom.juzList.appendChild(jFrag);

    // 4. Populate Direct Jump Surah dropdown
    const optFrag = document.createDocumentFragment();
    state.data.surahs.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${toAr(s.id)}. ${s.name} (${toAr(s.count)})`;
      optFrag.appendChild(opt);
    });
    dom.jumpSurah.innerHTML = '';
    dom.jumpSurah.appendChild(optFrag);
    updateJumpVerseBounds();
  }

  function renderSurahList(query) {
    const q = normalizeSearch(query);
    const frag = document.createDocumentFragment();

    state.data.surahs.forEach((s) => {
      const match =
        !q ||
        normalizeSearch(s.name).includes(q) ||
        String(s.id) === q ||
        toAr(s.id) === q;
      if (!match) return;

      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'index-item';
      btn.dataset.surahId = s.id;
      if (s.id === state.currentSurahId) btn.classList.add('active');

      const typeLabel = s.type === 'medinan' ? 'مدنية' : 'مكية';
      btn.innerHTML = `
        <span class="index-num">${toAr(s.id)}</span>
        <span class="index-main">
          <span class="index-title">${s.name}</span>
          <span class="index-sub">${typeLabel} · ${toAr(s.count)} آيات · ص ${toAr(s.startPage)}</span>
        </span>
      `;
      btn.addEventListener('click', () => {
        closeAllDrawers();
        openSurah(s.id);
      });
      li.appendChild(btn);
      frag.appendChild(li);
    });

    dom.surahList.innerHTML = '';
    dom.surahList.appendChild(frag);
  }

  function highlightActiveSurahInDrawer() {
    dom.surahList.querySelectorAll('.index-item').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.surahId) === state.currentSurahId);
    });
  }

  function updateJumpVerseBounds() {
    const sId = Number(dom.jumpSurah.value) || 1;
    const max = state.data.surahs[sId - 1].count;
    dom.jumpVerse.max = max;
    dom.jumpVerseMax.textContent = `(١ – ${toAr(max)})`;
    if (Number(dom.jumpVerse.value) > max) dom.jumpVerse.value = 1;
  }

  /* ==================== Drawers & Scroll Progress ==================== */
  function openDrawer(drawer) {
    closeVerseMenu();
    dom.navDrawer.classList.add('hidden');
    dom.settingsDrawer.classList.add('hidden');
    drawer.classList.remove('hidden');
    dom.backdrop.classList.remove('hidden');
  }

  function closeAllDrawers() {
    dom.navDrawer.classList.add('hidden');
    dom.settingsDrawer.classList.add('hidden');
    dom.backdrop.classList.add('hidden');
  }

  let scrollTick = false;
  function updateScrollIndicators() {
    scrollTick = false;
    const docEl = document.documentElement;
    const maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
    dom.progressFill.style.width = `${pct}%`;

    // Update current Juz & Page in top bar dynamically while scrolling
    const nodes = dom.versesStage.querySelectorAll('[data-verse]');
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i].getBoundingClientRect();
      if (r.bottom >= 85) {
        const j = nodes[i].dataset.juz;
        const p = nodes[i].dataset.page;
        const v = nodes[i].dataset.verse;
        dom.headerMeta.textContent = `الجزء ${toAr(j)} · ص ${toAr(p)} · الآية ${toAr(v)}`;
        break;
      }
    }
  }

  /* ==================== Event Bindings ==================== */
  function bindUIEvents() {
    dom.btnOpenNav.addEventListener('click', () => openDrawer(dom.navDrawer));
    dom.btnSurahTitle.addEventListener('click', () => openDrawer(dom.navDrawer));
    dom.btnCloseNav.addEventListener('click', closeAllDrawers);

    dom.btnOpenSettings.addEventListener('click', () => openDrawer(dom.settingsDrawer));
    dom.btnCloseSettings.addEventListener('click', closeAllDrawers);
    dom.backdrop.addEventListener('click', closeAllDrawers);

    // Quick style toggle
    dom.btnQuickStyle.addEventListener('click', () => {
      const order = ['mushaf', 'modern', 'minimal'];
      const labels = { mushaf: 'نمط المصحف التقليدي', modern: 'النمط الحديث', minimal: 'وضع التركيز الهادئ' };
      const next = order[(order.indexOf(state.settings.style) + 1) % order.length];
      state.settings.style = next;
      applySettingsToDOM(true);
      saveSettings();
      showToast(labels[next]);
    });

    // Minimal mode floating toggle
    dom.btnMinimalControls.addEventListener('click', () => {
      document.body.classList.toggle('minimal-show-ui');
    });

    // Continue reading controls
    dom.btnContinueTop.addEventListener('click', goToMarker);
    dom.btnContinueBannerGo.addEventListener('click', goToMarker);
    dom.btnContinueBannerClose.addEventListener('click', () => dom.continueBanner.classList.add('hidden'));
    dom.btnDrawerGoMarker.addEventListener('click', goToMarker);

    // Prev / Next Surah
    dom.btnPrevSurah.addEventListener('click', () => {
      if (state.currentSurahId > 1) openSurah(state.currentSurahId - 1);
    });
    dom.btnNextSurah.addEventListener('click', () => {
      if (state.currentSurahId < 114) openSurah(state.currentSurahId + 1);
    });

    // Drawer Tabs
    dom.navDrawer.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.navDrawer.querySelectorAll('.tab-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        const target = btn.dataset.tab;
        $('tabSurahs').classList.toggle('active', target === 'surahs');
        $('tabJuz').classList.toggle('active', target === 'juz');
        $('tabJump').classList.toggle('active', target === 'jump');
      });
    });

    // Search
    dom.surahSearch.addEventListener('input', (e) => renderSurahList(e.target.value));

    // Direct Jump
    dom.jumpSurah.addEventListener('change', updateJumpVerseBounds);
    dom.btnJumpVerseGo.addEventListener('click', () => {
      const sId = Number(dom.jumpSurah.value) || 1;
      const max = state.data.surahs[sId - 1].count;
      const vNum = Math.max(1, Math.min(max, Number(dom.jumpVerse.value) || 1));
      closeAllDrawers();
      openSurah(sId, vNum, true);
    });
    dom.btnJumpPageGo.addEventListener('click', () => {
      const p = Math.max(1, Math.min(604, Number(dom.jumpPage.value) || 1));
      const loc = state.pageIndexMap[p];
      if (loc) {
        closeAllDrawers();
        openSurah(loc.surah, loc.verse, true);
      }
    });

    // Settings controls
    dom.segTheme.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      state.settings.theme = btn.dataset.val;
      applySettingsToDOM(false);
      saveSettings();
    });

    dom.segStyle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      state.settings.style = btn.dataset.val;
      applySettingsToDOM(true);
      saveSettings();
    });

    dom.segAlign.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      state.settings.align = btn.dataset.val;
      applySettingsToDOM(false);
      saveSettings();
    });

    dom.segWidth.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      state.settings.width = btn.dataset.val;
      applySettingsToDOM(false);
      saveSettings();
    });

    dom.rangeFontSize.addEventListener('input', (e) => {
      state.settings.fontSize = Number(e.target.value);
      applySettingsToDOM(false);
    });
    dom.rangeFontSize.addEventListener('change', saveSettings);

    dom.rangeLineHeight.addEventListener('input', (e) => {
      state.settings.lineHeight = Number(e.target.value);
      applySettingsToDOM(false);
    });
    dom.rangeLineHeight.addEventListener('change', saveSettings);

    dom.btnResetSettings.addEventListener('click', () => {
      state.settings = { ...DEFAULT_SETTINGS };
      applySettingsToDOM(true);
      saveSettings();
      showToast('تمت إعادة ضبط الإعدادات الافتراضية');
    });

    mediaDark.addEventListener('change', () => {
      if (state.settings.theme === 'system') applyTheme();
    });

    // Scroll listener (rAF throttled)
    window.addEventListener('scroll', () => {
      if (!scrollTick) {
        scrollTick = true;
        requestAnimationFrame(updateScrollIndicators);
      }
    }, { passive: true });

    // Keyboard shortcuts (Esc to close)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVerseMenu();
        closeAllDrawers();
      }
    });
  }

  /* ==================== Service Worker ==================== */
  function registerSW() {
    if (!('serviceWorker' in navigator)) {
      dom.offlineStatusText.textContent = 'المتصفح لا يدعم Service Worker';
      return;
    }
    if (window.location.protocol === 'file:') {
      dom.offlineStatusText.textContent = 'تنبيه: افتح التطبيق عبر خادم محلي لتفعيل العمل بدون إنترنت';
      return;
    }
    navigator.serviceWorker.register('./sw.js')
      .then(() => {
        dom.offlineStatusText.textContent = 'مفعّل وجاهز للعمل الكامل بدون إنترنت';
      })
      .catch(() => {
        dom.offlineStatusText.textContent = 'تعذّر تسجيل العمل بدون إنترنت';
      });
  }

  /* ==================== Bootstrap ==================== */
  async function init() {
    bindUIEvents();
    bindVerseGestures();

    // Load persisted settings & permanent reading marker in parallel
    const [savedSettings, savedMarker, lastView] = await Promise.all([
      QuranDB.getSettings(),
      QuranDB.getMarker(),
      QuranDB.getLastView()
    ]);

    if (savedSettings && typeof savedSettings === 'object') {
      state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    }
    if (savedMarker && savedMarker.surah && savedMarker.verse) {
      state.marker = savedMarker;
    }

    applySettingsToDOM(false);

    try {
      const resp = await fetch('./data/quran.json');
      if (!resp.ok) throw new Error('Failed to load Quran dataset');
      state.data = await resp.json();
    } catch (err) {
      dom.loadingState.innerHTML = '<p>تعذّر تحميل بيانات المصحف. تأكد من تشغيل التطبيق عبر خادم محلي (راجع ملف README.md).</p>';
      return;
    }

    buildNavigationIndexes();
    updateMarkerUI();

    dom.loadingState.classList.add('hidden');
    dom.surahContainer.classList.remove('hidden');

    // Open last viewed surah (or marker surah if first launch with marker) without overwriting marker
    const initialSurah = (lastView && lastView.surah) ? lastView.surah : (state.marker ? state.marker.surah : 1);
    openSurah(initialSurah, null, false);

    // If user has a permanent marker, show the convenient Continue Reading banner on launch
    if (state.marker) {
      dom.continueBanner.classList.remove('hidden');
    }

    registerSW();
  }

  init();
})();
