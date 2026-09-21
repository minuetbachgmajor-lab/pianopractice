/* Boot, routing and the practice clock. */
(function (w) {
  'use strict';

  var el = w.PP.ui.el;
  var d = w.document;
  var view = 'home';
  var arg = null;
  var mount, tabbar;

  var TABS = [
    { id: 'home',       emoji: '🎹', label: 'Pieces' },
    { id: 'collection', emoji: '🎒', label: 'Collection' },
    { id: 'parent',     emoji: '🔒', label: 'Grown-ups' }
  ];

  function go(next, a) {
    view = next;
    arg = typeof a === 'undefined' ? null : a;
    w.PP.charts.hideTip();
    w.PP.ui.closeAll();
    draw();
    try { w.scrollTo(0, 0); } catch (e) {}
    setHash();
  }

  function setHash() {
    var h = '#' + view + (arg ? '/' + arg : '');
    try { if (w.location.hash !== h) { w.location.hash = h; } } catch (e) {}
  }

  function readHash() {
    var h = (w.location.hash || '').replace(/^#/, '');
    if (!h) { return null; }
    var parts = h.split('/');
    return { view: parts[0], arg: parts[1] || null };
  }

  function draw() {
    w.PP.ui.clear(mount);
    if (view === 'practice') {
      w.PP.engine.ensureSession(w.PP.store.get(), Date.now());
      w.PP.viewPractice.render(mount, arg);
    } else if (view === 'collection') {
      w.PP.viewCollection.render(mount);
    } else if (view === 'parent') {
      w.PP.viewParent.render(mount);
    } else {
      w.PP.viewHome.render(mount);
    }
    drawTabs();
  }

  function drawTabs() {
    var current = view === 'practice' ? 'home' : view;
    var kids = tabbar.childNodes, i;
    for (i = 0; i < kids.length; i++) {
      kids[i].className = kids[i].getAttribute('data-tab') === current ? 'on' : '';
    }
  }

  function buildTabs() {
    tabbar = el('nav', { class: 'tabbar' });
    TABS.forEach(function (t) {
      tabbar.appendChild(el('button', {
        'data-tab': t.id,
        onclick: function () { go(t.id); }
      }, [
        el('span', { class: 'e', text: t.emoji }),
        el('span', { text: t.label })
      ]));
    });
    d.body.appendChild(tabbar);
  }

  /* ---- the practice clock ------------------------------------------ */
  /* Minutes only tick while the practice screen is open and the app is in
   * front, so "20 minutes" means twenty minutes at the piano. */
  var TICK = 15000;
  var unsaved = 0;

  function tick() {
    if (view !== 'practice') { return; }
    if (d.hidden || d.webkitHidden) { return; }
    var state = w.PP.store.get();
    w.PP.engine.addActiveMs(state, TICK);
    unsaved += TICK;
    if (unsaved >= 60000) { w.PP.store.save(); unsaved = 0; }
  }

  function flush() {
    if (unsaved > 0) { w.PP.store.save(); unsaved = 0; }
  }

  function boot() {
    mount = d.getElementById('app');
    buildTabs();

    var start = readHash();
    if (start && start.view) { view = start.view; arg = start.arg; }
    if (view === 'parent') { w.PP.viewParent.lock(); }
    draw();

    w.setInterval(tick, TICK);
    w.addEventListener('pagehide', flush, false);
    w.addEventListener('beforeunload', flush, false);
    d.addEventListener('visibilitychange', function () {
      if (d.hidden) { flush(); }
    }, false);
    w.addEventListener('hashchange', function () {
      var h = readHash();
      if (!h) { return; }
      if (h.view !== view || h.arg !== arg) { view = h.view; arg = h.arg; draw(); }
    }, false);

    registerWorker();
  }

  /* Keeping the installed app current.
   *
   * An installed PWA has no address bar and no reload button, so if a new
   * build never reaches it there is nothing the person holding the iPad can
   * do about it. Ask for an update on every launch, and when a new worker
   * takes over, reload once so the running page is not left on the old
   * scripts. */
  function registerWorker() {
    if (!('serviceWorker' in w.navigator)) { return; }
    var hadController = !!w.navigator.serviceWorker.controller;
    var reloaded = false;

    w.addEventListener('load', function () {
      w.navigator.serviceWorker.register('sw.js').then(function (reg) {
        try { reg.update(); } catch (e) { /* older Safari */ }
        if (reg.active) { reg.active.postMessage('version'); }
      }).catch(function () { /* offline is a bonus, not a requirement */ });
    }, false);

    w.navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'version') { w.PP.buildVersion = e.data.version; }
    }, false);

    /* Only reload for a REPLACEMENT worker. On a first install there was no
     * controller, and reloading then would be a pointless flash. */
    w.navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded) { return; }
      reloaded = true;
      w.location.reload();
    }, false);
  }

  /* Bumped with each release. If this and the service worker's version
   * disagree, the page is running older scripts than the worker has — which
   * is exactly the failure that hid three releases from an installed iPad. */
  w.PP.appVersion = '2026-09-21.4';
  w.PP.app = { go: go, redraw: draw };

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }
})(window);
