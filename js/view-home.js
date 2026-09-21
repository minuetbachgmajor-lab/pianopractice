/* Home: today at a glance, then the pieces and their bits. */
(function (w) {
  'use strict';

  var el = w.PP.ui.el, ui = w.PP.ui;

  var GREETINGS = ['Hello', 'Hi there', 'Ready?', 'Welcome back', 'Good to see you'];

  function render(container) {
    var state = w.PP.store.get();
    ui.clear(container);

    var name = state.child.name ? state.child.name : '';
    var todayFrom = w.PP.stats.startOfDay(Date.now());
    var today = w.PP.stats.summary(state, todayFrom);

    container.appendChild(el('div', { class: 'topbar' }, [
      el('div', { class: 'grow' }, [
        el('h1', { text: (name ? GREETINGS[new Date().getDay() % GREETINGS.length] + ', ' + name + '!' : 'Piano Practice') }),
        el('div', { class: 'sub', text: subtitleFor(today) })
      ]),
      el('button', {
        class: 'icon-btn', 'aria-label': 'Grown-ups',
        onclick: function () { w.PP.app.go('parent'); }
      }, ['🔒'])
    ]));

    if (w.PP.store.saveFailed()) {
      container.appendChild(el('div', { class: 'warn-banner', text:
        '⚠️ This iPad would not save the last change. Ask a grown-up to free up space, and back up from the parent area.' }));
    }

    container.appendChild(el('div', { class: 'stat-tiles', style: 'margin-bottom:14px' }, [
      tile('⭐ ' + today.perfect, 'perfect today'),
      tile('🎯 ' + today.runs, today.runs === 1 ? 'streak cleared' : 'streaks cleared'),
      tile('⏱ ' + today.minutes, 'minutes today'),
      tile('🔥 ' + today.dayStreak, today.dayStreak === 1 ? 'day in a row' : 'days in a row')
    ]));

    var resume = findResume(state);
    if (resume) {
      container.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'grow' }, [
            el('h2', { text: '▶️ Carry on where you left off' }),
            el('div', { class: 'tiny muted', text: resume.piece.name + ' · ' + resume.section.label +
              ' — ' + resume.run.streak + ' of ' + resume.run.goal + ' stars' })
          ])
        ]),
        el('button', {
          class: 'btn mint block',
          onclick: function () { w.PP.app.go('practice', resume.section.id); }
        }, ['Keep going'])
      ]));
    }

    var i, active = 0;
    for (i = 0; i < state.pieces.length; i++) {
      if (state.pieces[i].archived) { continue; }
      active += 1;
      container.appendChild(pieceCard(state, state.pieces[i]));
    }

    if (!active) {
      container.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'empty-note' }, [
          el('span', { class: 'e', text: '🎼' }),
          el('p', { text: 'No pieces yet!' }),
          el('p', { class: 'tiny muted', text: 'A grown-up can add this week’s pieces in the parent area.' }),
          el('button', { class: 'btn', onclick: function () { w.PP.app.go('parent'); } }, ['Open parent area'])
        ])
      ]));
    }
  }

  function subtitleFor(today) {
    if (!today.passes) { return 'Nothing played yet today. Pick a bit to start!'; }
    if (today.runs) { return 'Great work today — ' + ui.plural(today.runs, 'bit') + ' cleared.'; }
    return ui.plural(today.passes, 'try', 'tries') + ' so far today.';
  }

  function tile(n, k) {
    return el('div', { class: 'tile' }, [
      el('span', { class: 'n', text: n }),
      el('span', { class: 'k', text: k })
    ]);
  }

  function findResume(state) {
    var i, r, found, cutoff = Date.now() - w.PP.engine.SESSION_GAP_MS;
    for (i = state.runs.length - 1; i >= 0; i--) {
      r = state.runs[i];
      if (r.completedAt || r.streak === 0) { continue; }
      if (r.startedAt < cutoff) { continue; }
      found = w.PP.store.findSection(state, r.sectionId);
      if (found && !found.section.archived) {
        return { run: r, piece: found.piece, section: found.section };
      }
    }
    return null;
  }

  function pieceCard(state, piece) {
    var card = el('div', { class: 'card' });
    var sections = [], i;
    for (i = 0; i < piece.sections.length; i++) {
      if (!piece.sections[i].archived) { sections.push(piece.sections[i]); }
    }
    var cleared = 0;
    for (i = 0; i < sections.length; i++) {
      if (w.PP.engine.clearedToday(state, sections[i].id)) { cleared += 1; }
    }

    card.appendChild(el('div', { class: 'piece-title' }, [
      el('span', { class: 'emoji', text: piece.emoji || '🎵' }),
      el('div', { class: 'grow' }, [
        el('h2', { text: piece.name, style: 'margin:0' }),
        piece.composer ? el('div', { class: 'tiny muted', text: piece.composer }) : null
      ]),
      sections.length ? el('span', {
        class: 'pill' + (cleared === sections.length ? ' ok' : ''),
        text: cleared + '/' + sections.length + ' today'
      }) : null
    ]));

    if (!sections.length) {
      card.appendChild(el('div', { class: 'tiny muted', text: 'No bits set up for this piece yet.' }));
      return card;
    }

    for (i = 0; i < sections.length; i++) {
      card.appendChild(sectionRow(state, sections[i]));
    }
    return card;
  }

  function sectionRow(state, section) {
    var done = w.PP.engine.clearedToday(state, section.id);
    var run = w.PP.engine.activeRun(state, section.id);
    var goal = state.settings.streakGoal;
    var meta, status;

    if (done) {
      status = '✅';
      meta = 'Cleared today — play it again any time';
    } else if (run && run.passCount) {
      status = '🎯';
      meta = run.streak + ' of ' + goal + ' stars · ' + ui.plural(run.passCount, 'try', 'tries') + ' so far';
    } else {
      status = '▶️';
      meta = lastClearedText(state, section.id);
    }

    return el('button', {
      class: 'section-row' + (done ? ' done' : '') + (section.parentId ? ' child' : ''),
      onclick: function () { w.PP.app.go('practice', section.id); }
    }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'label', text: (section.auto ? '🔍 ' : '') + section.label }),
        el('div', { class: 'meta', text: meta })
      ]),
      el('div', { class: 'status', text: status })
    ]);
  }

  function lastClearedText(state, sectionId) {
    var i, r, last = null;
    for (i = state.runs.length - 1; i >= 0; i--) {
      r = state.runs[i];
      if (r.sectionId === sectionId && r.completedAt) { last = r; break; }
    }
    if (!last) { return 'Not cleared yet — be the first!'; }
    return 'Last cleared ' + ui.fmtDate(last.completedAt) + ' in ' + ui.plural(last.passCount, 'try', 'tries');
  }

  w.PP.viewHome = { render: render };
})(window);
