/* Small DOM toolkit. No framework: on an iPad mini 3 the fastest UI is the
 * one that ships no library at all. */
(function (w) {
  'use strict';

  var d = w.document;

  function el(tag, attrs, children) {
    var node = d.createElement(tag), k, i, c;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
        if (k === 'class') { node.className = attrs[k]; }
        else if (k === 'text') { node.textContent = attrs[k]; }
        else if (k === 'html') { node.innerHTML = attrs[k]; }
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2), attrs[k], false);
        } else if (attrs[k] !== null && typeof attrs[k] !== 'undefined') {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      for (i = 0; i < children.length; i++) {
        c = children[i];
        if (c === null || typeof c === 'undefined' || c === false) { continue; }
        node.appendChild(typeof c === 'string' ? d.createTextNode(c) : c);
      }
    }
    return node;
  }

  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }

  function fmtTime(ts) {
    var dt = new Date(ts), h = dt.getHours(), m = dt.getMinutes();
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (h === 0) { h = 12; }
    return h + ':' + (m < 10 ? '0' + m : m) + ampm;
  }

  function fmtDate(ts) {
    var dt = new Date(ts);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function fmtDuration(ms) {
    var s = Math.round(ms / 1000);
    if (s < 60) { return s + 's'; }
    var m = Math.floor(s / 60);
    if (m < 60) { return m + ' min'; }
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* ---- overlays ---- */
  var openLayers = [];

  function overlay(kind, build, onClose) {
    var scrim = el('div', { class: 'scrim' });
    var box = el('div', { class: kind === 'sheet' ? 'sheet' : 'center-modal' });
    if (kind === 'sheet') { box.appendChild(el('div', { class: 'grabber' })); }
    var api = {
      box: box,
      close: function () {
        if (scrim.parentNode) { scrim.parentNode.removeChild(scrim); }
        if (box.parentNode) { box.parentNode.removeChild(box); }
        var i = openLayers.indexOf(api);
        if (i >= 0) { openLayers.splice(i, 1); }
        if (onClose) { onClose(); }
      }
    };
    scrim.addEventListener('click', api.close, false);
    build(box, api);
    d.body.appendChild(scrim);
    d.body.appendChild(box);
    openLayers.push(api);
    return api;
  }

  function sheet(build, onClose) { return overlay('sheet', build, onClose); }
  function modal(build, onClose) { return overlay('modal', build, onClose); }
  function closeAll() { while (openLayers.length) { openLayers[openLayers.length - 1].close(); } }

  function confirmBox(opts, onYes) {
    modal(function (box, api) {
      box.appendChild(el('h2', { text: opts.title || 'Are you sure?' }));
      if (opts.body) { box.appendChild(el('p', { class: 'muted', text: opts.body })); }
      box.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn ghost', onclick: api.close }, [opts.no || 'Cancel']),
        el('button', {
          class: 'btn ' + (opts.danger ? 'danger' : ''),
          onclick: function () { api.close(); onYes(); }
        }, [opts.yes || 'Yes'])
      ]));
    });
  }

  function promptBox(opts, onOk) {
    modal(function (box, api) {
      var input = el('input', {
        type: opts.numeric ? 'tel' : 'text',
        value: opts.value || '',
        class: opts.pin ? 'pin-input' : '',
        maxlength: opts.maxlength || null
      });
      box.appendChild(el('h2', { text: opts.title }));
      if (opts.body) { box.appendChild(el('p', { class: 'muted tiny', text: opts.body })); }
      box.appendChild(el('label', { class: 'field' }, [input]));
      var err = el('p', { class: 'tiny', style: 'color:var(--danger);display:none' });
      box.appendChild(err);
      function submit() {
        var v = input.value;
        if (opts.validate) {
          var msg = opts.validate(v);
          if (msg) { err.textContent = msg; err.style.display = 'block'; return; }
        }
        api.close();
        onOk(v);
      }
      input.addEventListener('keydown', function (e) { if (e.keyCode === 13) { submit(); } }, false);
      box.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn ghost', onclick: api.close }, ['Cancel']),
        el('button', { class: 'btn', onclick: submit }, [opts.ok || 'OK'])
      ]));
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var old = d.querySelector('.toast');
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    var t = el('div', { class: 'toast', text: msg });
    d.body.appendChild(t);
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      if (t.parentNode) { t.parentNode.removeChild(t); }
    }, 2200);
  }

  /* ---- celebration ---- */
  var CONFETTI_COLORS = ['#ff7aa8', '#7b61d6', '#3fc8b4', '#ffcf5c', '#5bb8f5', '#ff9f6e'];

  function confetti(count) {
    var n = count || 40, i, piece, left, delay, dur;
    for (i = 0; i < n; i++) {
      left = Math.random() * 100;
      delay = Math.random() * 0.5;
      dur = 1.6 + Math.random() * 1.4;
      piece = el('div', { class: 'confetti-piece' });
      piece.style.left = left + '%';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.webkitTransform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      piece.style.transform = piece.style.webkitTransform;
      piece.style.webkitAnimation = 'fall ' + dur + 's linear ' + delay + 's forwards';
      piece.style.animation = piece.style.webkitAnimation;
      d.body.appendChild(piece);
      dropLater(piece, (dur + delay) * 1000);
    }
  }
  function dropLater(node, ms) {
    setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, ms);
  }

  /* Web Audio on iOS only works after a touch, so the context is created
   * lazily inside the tap handler that wants a sound. */
  var audioCtx = null;
  function tone(freqs, when) {
    var state = w.PP.store.get();
    if (!state.settings.sound) { return; }
    try {
      var Ctx = w.AudioContext || w.webkitAudioContext;
      if (!Ctx) { return; }
      if (!audioCtx) { audioCtx = new Ctx(); }
      if (audioCtx.state === 'suspended' && audioCtx.resume) { audioCtx.resume(); }
      var t0 = audioCtx.currentTime + (when || 0);
      for (var i = 0; i < freqs.length; i++) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freqs[i];
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.14, t0 + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0 + i * 0.09);
        osc.stop(t0 + i * 0.09 + 0.3);
      }
    } catch (e) { /* audio is a nicety, never a blocker */ }
  }
  var sounds = {
    star:    function () { tone([880]); },
    oops:    function () { tone([392, 330]); },
    clear:   function () { tone([523, 659, 784, 1047]); },
    badge:   function () { tone([659, 784, 1047, 1319]); }
  };

  w.PP = w.PP || {};
  w.PP.ui = {
    el: el, clear: clear,
    fmtTime: fmtTime, fmtDate: fmtDate, fmtDuration: fmtDuration, plural: plural,
    sheet: sheet, modal: modal, closeAll: closeAll,
    confirm: confirmBox, prompt: promptBox, toast: toast,
    confetti: confetti, sounds: sounds
  };
})(window);
