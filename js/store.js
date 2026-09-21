/* Persistent state.
 *
 * Everything lives in one localStorage key. The shape is versioned so future
 * changes can migrate rather than wipe. No optional chaining, no spread in
 * hot paths: this has to run on Safari 12 (iPad mini 3). */
(function (w) {
  'use strict';

  var KEY = 'pianopractice.v1';
  var VERSION = 1;

  function uid(prefix) {
    return (prefix || 'id') + '_' +
      Date.now().toString(36) + '_' +
      Math.floor(Math.random() * 1679616).toString(36);
  }

  /* Deliberately not cryptography. It stops a curious 8-year-old reading the
   * PIN out of localStorage; it is not a secret store. */
  function pinHash(pin) {
    var h = 5381, i, s = 'pp:' + String(pin);
    for (i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
    return (h >>> 0).toString(36);
  }

  function seedPieces() {
    var now = Date.now();
    return [{
      id: uid('pc'), name: 'Minuet in G major', composer: 'Bach', emoji: '🎼',
      createdAt: now, archived: false, criteria: null,
      sections: [
        { id: uid('sc'), label: 'Section A (m. 1–8)',  notes: 'Hands together, watch the LH skips', tempo: 72, archived: false, createdAt: now, auto: false, parentId: null, criteria: null },
        { id: uid('sc'), label: 'Section B (m. 9–16)', notes: 'The tricky trill bar',                tempo: 72, archived: false, createdAt: now, auto: false, parentId: null, criteria: null },
        { id: uid('sc'), label: 'Whole piece',         notes: 'Start to finish, no stopping',        tempo: 84, archived: false, createdAt: now, auto: false, parentId: null, criteria: null }
      ]
    }];
  }

  function freshState() {
    return {
      v: VERSION,
      child: { name: '' },
      settings: {
        streakGoal: 3,
        coachAfter: 5,
        pin: pinHash('1234'),
        pinIsDefault: true,
        activeCriteria: w.PP.criteria.defaultActive(),
        customCriteria: [],
        sound: true
      },
      pieces: seedPieces(),
      sessions: [],
      passes: [],
      runs: [],
      stickers: [],
      badges: [],
      coachEvents: []
    };
  }

  /* Repairs anything missing so a hand-edited or partial import cannot brick
   * the app on load. */
  function normalize(state) {
    var base = freshState(), keys = ['pieces', 'sessions', 'passes', 'runs', 'stickers', 'badges', 'coachEvents'], i, k;
    if (!state || typeof state !== 'object') { return base; }
    state.v = VERSION;
    state.child = state.child || { name: '' };
    state.settings = state.settings || base.settings;
    for (k in base.settings) {
      if (Object.prototype.hasOwnProperty.call(base.settings, k) &&
          typeof state.settings[k] === 'undefined') {
        state.settings[k] = base.settings[k];
      }
    }
    if (!state.settings.activeCriteria || !state.settings.activeCriteria.length) {
      state.settings.activeCriteria = w.PP.criteria.defaultActive();
    }
    for (i = 0; i < keys.length; i++) {
      if (!Array.isArray(state[keys[i]])) { state[keys[i]] = []; }
    }
    if (!Array.isArray(state.settings.customCriteria)) { state.settings.customCriteria = []; }
    /* A saved file from before criteria became assignable has no `criteria`
     * on its pieces or sections; null means "inherit", which is exactly the
     * old behaviour, so those files upgrade silently. */
    for (i = 0; i < state.pieces.length; i++) {
      if (!Array.isArray(state.pieces[i].sections)) { state.pieces[i].sections = []; }
      if (!Array.isArray(state.pieces[i].criteria)) { state.pieces[i].criteria = null; }
      for (var si = 0; si < state.pieces[i].sections.length; si++) {
        if (!Array.isArray(state.pieces[i].sections[si].criteria)) {
          state.pieces[i].sections[si].criteria = null;
        }
      }
    }
    return state;
  }

  var cache = null;
  var listeners = [];

  function load() {
    if (cache) { return cache; }
    var raw = null;
    try { raw = w.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) { cache = freshState(); save(); return cache; }
    try { cache = normalize(JSON.parse(raw)); } catch (e2) { cache = freshState(); }
    return cache;
  }

  var saveFailed = false;
  function save() {
    if (!cache) { return; }
    try {
      w.localStorage.setItem(KEY, JSON.stringify(cache));
      saveFailed = false;
    } catch (e) {
      saveFailed = true;
    }
    for (var i = 0; i < listeners.length; i++) { listeners[i](cache); }
  }

  function findSection(state, sectionId) {
    var i, j, p;
    for (i = 0; i < state.pieces.length; i++) {
      p = state.pieces[i];
      for (j = 0; j < p.sections.length; j++) {
        if (p.sections[j].id === sectionId) { return { piece: p, section: p.sections[j] }; }
      }
    }
    return null;
  }

  function sectionLabel(state, sectionId) {
    var f = findSection(state, sectionId);
    return f ? f.section.label : 'Unknown bit';
  }
  function pieceName(state, pieceId) {
    var i;
    for (i = 0; i < state.pieces.length; i++) {
      if (state.pieces[i].id === pieceId) { return state.pieces[i].name; }
    }
    return 'Unknown piece';
  }

  w.PP = w.PP || {};
  w.PP.store = {
    KEY: KEY,
    VERSION: VERSION,
    uid: uid,
    pinHash: pinHash,
    freshState: freshState,
    normalize: normalize,
    get: load,
    save: save,
    saveFailed: function () { return saveFailed; },
    onChange: function (fn) { listeners.push(fn); },
    replace: function (next) { cache = normalize(next); save(); return cache; },
    reset: function () { cache = freshState(); save(); return cache; },
    findSection: findSection,
    sectionLabel: sectionLabel,
    pieceName: pieceName,
    checkPin: function (pin) { return pinHash(pin) === load().settings.pin; },
    setPin: function (pin) {
      var s = load();
      s.settings.pin = pinHash(pin);
      s.settings.pinIsDefault = (String(pin) === '1234');
      save();
    }
  };
})(window);
