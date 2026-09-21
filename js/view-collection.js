/* The sticker book and the badge shelf — the part she shows people. */
(function (w) {
  'use strict';

  var el = w.PP.ui.el, ui = w.PP.ui;

  function render(container) {
    var state = w.PP.store.get();
    ui.clear(container);

    container.appendChild(el('div', { class: 'topbar' }, [
      el('div', { class: 'grow' }, [
        el('h1', { text: '🎒 My collection' }),
        el('div', { class: 'sub', text: ui.plural(state.stickers.length, 'sticker') + ' · ' +
          ui.plural(state.badges.length, 'badge') })
      ])
    ]));

    container.appendChild(stickerCard(state));
    container.appendChild(badgeCard(state));
    container.appendChild(cardsCard(state));
  }

  function stickerCard(state) {
    var card = el('div', { class: 'card' }, [el('h2', { text: '✨ Sticker book' })]);
    if (!state.stickers.length) {
      card.appendChild(el('div', { class: 'empty-note' }, [
        el('span', { class: 'e', text: '🩹' }),
        el('p', { class: 'tiny muted', text: 'Clear three perfect in a row and your first sticker lands here.' })
      ]));
      return card;
    }
    var grid = el('div', { class: 'sticker-grid' }), i, s;
    for (i = state.stickers.length - 1; i >= 0; i--) {
      s = state.stickers[i];
      grid.appendChild(el('div', {
        class: 'sticker ' + (s.golden ? 'gold' : s.tint),
        title: w.PP.store.sectionLabel(state, s.sectionId)
      }, [
        el('span', { text: s.emoji }),
        el('span', { class: 'when', text: ui.fmtDate(s.ts) })
      ]));
    }
    card.appendChild(grid);
    card.appendChild(el('p', { class: 'tiny muted', style: 'margin-top:10px',
      text: 'Gold stickers are for streaks with no mistakes at all.' }));
    return card;
  }

  function badgeCard(state) {
    var earned = {}, i;
    for (i = 0; i < state.badges.length; i++) { earned[state.badges[i].key] = state.badges[i].earnedAt; }

    var grid = el('div', { class: 'badge-grid' }), all = w.PP.badges.ALL, b;
    for (i = 0; i < all.length; i++) {
      b = all[i];
      grid.appendChild(el('div', { class: 'badge' + (earned[b.key] ? '' : ' locked') }, [
        el('span', { class: 'e', text: earned[b.key] ? b.emoji : '🔒' }),
        el('span', { class: 'n', text: b.name }),
        el('span', { class: 'b', text: earned[b.key] ? ui.fmtDate(earned[b.key]) : b.blurb })
      ]));
    }
    return el('div', { class: 'card' }, [el('h2', { text: '🏅 Badges' }), grid]);
  }

  function cardsCard(state) {
    var cards = w.PP.stats.scoreCards(state, 8), card, i, c;
    card = el('div', { class: 'card' }, [el('h2', { text: '📋 Score cards' })]);
    if (!cards.length) {
      card.appendChild(el('p', { class: 'tiny muted', text: 'Each cleared streak saves a score card here.' }));
      return card;
    }
    for (i = 0; i < cards.length; i++) {
      c = cards[i];
      card.appendChild(scoreRow(c));
    }
    return card;
  }

  function scoreRow(c) {
    var run = c.run;
    return el('button', {
      class: 'section-row',
      onclick: function () {
        ui.modal(function (box, api) {
          box.appendChild(w.PP.viewPractice.scoreCardNode(run, c.sticker, {
            piece: { name: c.piece }, section: { label: c.section }
          }));
          box.appendChild(el('p', { class: 'tiny muted center', style: 'margin-top:10px',
            text: 'Cleared ' + ui.fmtDate(run.completedAt) + ' at ' + ui.fmtTime(run.completedAt) }));
          box.appendChild(el('button', { class: 'btn block ghost', style: 'margin-top:10px', onclick: api.close }, ['Close']));
        });
      }
    }, [
      el('div', { class: 'status', style: 'margin:0 10px 0 0', text: c.sticker ? c.sticker.emoji : '⭐' }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'label', text: c.section }),
        el('div', { class: 'meta', text: c.piece + ' · ' + ui.fmtDate(run.completedAt) + ' · ' +
          ui.plural(run.passCount, 'try', 'tries') + (run.failCount === 0 ? ' · flawless' : '') })
      ]),
      el('div', { class: 'status', text: '›' })
    ]);
  }

  w.PP.viewCollection = { render: render };
})(window);
