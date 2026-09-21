/* The parent area: set up the work, read the reports, get the data out.
 *
 * The PIN is a door, not a vault — it stops a curious 8-year-old wandering in,
 * and nothing more. Her log is never edited from here: the self-assessment is
 * the point of the whole exercise. */
(function (w) {
  'use strict';

  var el = w.PP.ui.el, ui = w.PP.ui;
  var unlocked = false;
  var tab = 'reports';
  var rangeDays = 30;

  function render(container) {
    var state = w.PP.store.get();
    ui.clear(container);
    if (!unlocked) { return lock(container, state); }

    container.appendChild(el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: function () { w.PP.app.go('home'); } }, ['‹']),
      el('div', { class: 'grow', style: 'margin-left:10px' }, [
        el('h1', { text: 'Grown-ups', style: 'font-size:22px' }),
        el('div', { class: 'sub', text: 'Setup, reports and backups' })
      ]),
      el('button', { class: 'icon-btn', 'aria-label': 'Lock', onclick: function () { unlocked = false; render(container); } }, ['🔓'])
    ]));

    if (state.settings.pinIsDefault) {
      container.appendChild(el('div', { class: 'warn-banner', text:
        '🔑 The PIN is still 1234. Change it in Settings so the parent area stays yours.' }));
    }

    var tabs = el('div', { class: 'tabs' });
    [['reports', '📊 Reports'], ['pieces', '🎼 Pieces'], ['criteria', '🏷 Criteria'],
     ['settings', '⚙️ Settings'], ['data', '💾 Data']].forEach(function (t) {
      tabs.appendChild(el('button', {
        class: tab === t[0] ? 'on' : '',
        onclick: function () { tab = t[0]; render(container); }
      }, [t[1]]));
    });
    container.appendChild(tabs);

    var body = el('div');
    container.appendChild(body);
    if (tab === 'reports') { reports(body, state); }
    else if (tab === 'pieces') { pieces(body, state, container); }
    else if (tab === 'criteria') { criteria(body, state, container); }
    else if (tab === 'settings') { settings(body, state, container); }
    else { data(body, state, container); }
  }

  /* ---- lock screen -------------------------------------------------- */
  function lock(container, state) {
    var input = el('input', { type: 'tel', class: 'pin-input', maxlength: '8', placeholder: '••••' });
    var err = el('p', { class: 'tiny center', style: 'color:var(--danger);display:none', text: 'Not quite. Try again.' });

    function tryPin() {
      if (w.PP.store.checkPin(input.value)) { unlocked = true; render(container); }
      else { err.style.display = 'block'; input.value = ''; }
    }
    input.addEventListener('keydown', function (e) { if (e.keyCode === 13) { tryPin(); } }, false);

    container.appendChild(el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: function () { w.PP.app.go('home'); } }, ['‹']),
      el('div', { class: 'grow', style: 'margin-left:10px' }, [el('h1', { text: 'Grown-ups only' })])
    ]));
    container.appendChild(el('div', { class: 'card center' }, [
      el('div', { style: 'font-size:46px', text: '🔒' }),
      el('p', { class: 'muted tiny', text: 'Enter the parent PIN. (It starts as 1234.)' }),
      el('label', { class: 'field' }, [input]),
      err,
      el('button', { class: 'btn block', onclick: tryPin }, ['Unlock'])
    ]));
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 80);
  }

  /* ---- reports ------------------------------------------------------ */
  function reports(body, state) {
    var from = w.PP.stats.rangeStart(rangeDays);
    var s = w.PP.stats.summary(state, from);

    var filter = el('div', { class: 'tabs' });
    [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']].forEach(function (r) {
      filter.appendChild(el('button', {
        class: rangeDays === r[0] ? 'on' : '',
        onclick: function () { rangeDays = r[0]; render(body.parentNode); }
      }, [r[1]]));
    });
    body.appendChild(filter);

    body.appendChild(el('div', { class: 'stat-tiles', style: 'margin-bottom:14px' }, [
      tile(String(s.runs), 'streaks cleared'),
      tile(s.avgTries ? String(s.avgTries) : '—', 'tries per streak'),
      tile(s.perfectPct + '%', 'passes perfect'),
      tile(String(s.minutes), 'minutes practised')
    ]));

    /* 1. what she catches most */
    var mix = w.PP.stats.criteriaMix(state, from);
    body.appendChild(chartCard(
      'What she catches most',
      'Her own tags, counted. The top row is where a lesson minute buys the most.',
      w.PP.charts.rankedBar(mix.rows.slice(0, 10).map(function (r) {
        return { label: r.label, value: r.count, emoji: r.emoji, _r: r };
      }), {
        title: 'Most-tagged criteria',
        empty: 'No mistakes tagged in this window.',
        tip: function (row) { return row.value + ' of ' + mix.total + ' tags (' + row._r.pct + '%)'; }
      }),
      [{ key: 'label', label: 'Criterion' }, { key: 'count', label: 'Times', num: true }, { key: 'pct', label: '%', num: true }],
      mix.rows
    ));

    /* 2. is it getting easier */
    var trend = w.PP.stats.triesTrend(state, from), pts = [], i;
    for (i = 0; i < trend.length; i++) {
      pts.push({
        label: ui.fmtDate(trend[i].start),
        y: trend[i].avg,
        tip: trend[i].avg + ' tries per streak · ' + ui.plural(trend[i].runs, 'streak')
      });
    }
    body.appendChild(chartCard(
      'Tries needed per streak, by week',
      'Going down means the same bits are getting cleaner in fewer passes.',
      w.PP.charts.lineTrend(pts, { title: 'Average tries per cleared streak' }),
      [{ key: 'week', label: 'Week of' }, { key: 'avg', label: 'Avg tries', num: true }, { key: 'runs', label: 'Streaks', num: true }],
      trend.map(function (t) { return { week: ui.fmtDate(t.start), avg: t.avg, runs: t.runs }; })
    ));

    /* 3. the habit */
    var cells = w.PP.stats.heatmap(state, 14);
    body.appendChild(chartCard(
      'Practice calendar',
      'Fourteen weeks of minutes at the piano. Consistency beats marathons.',
      w.PP.charts.heatmap(cells),
      [{ key: 'key', label: 'Date' }, { key: 'minutes', label: 'Minutes', num: true },
       { key: 'passes', label: 'Tries', num: true }, { key: 'runs', label: 'Cleared', num: true }],
      cells.filter(function (c) { return c.passes > 0; }).reverse()
    ));

    /* 4. which bits are hard */
    var diff = w.PP.stats.sectionDifficulty(state, from);
    body.appendChild(chartCard(
      'Hardest bits',
      'Average tries to clear. The top of this list is next week’s lesson conversation.',
      w.PP.charts.rankedBar(diff.slice(0, 8).map(function (d) {
        return { label: d.label, value: d.avgTries, emoji: d.topTag ? w.PP.criteria.emoji(d.topTag) : null, _d: d };
      }), {
        title: 'Sections by average tries',
        empty: 'Nothing cleared in this window yet.',
        format: function (v) { return String(v); },
        tip: function (r) {
          return r._d.piece + ' · ' + ui.plural(r._d.runs, 'streak') + ' cleared' +
            (r._d.topTag ? ' · mostly ' + w.PP.criteria.label(r._d.topTag).toLowerCase() : '');
        }
      }),
      [{ key: 'label', label: 'Section' }, { key: 'piece', label: 'Piece' },
       { key: 'avgTries', label: 'Avg tries', num: true }, { key: 'runs', label: 'Cleared', num: true },
       { key: 'top', label: 'Most tagged' }],
      diff.map(function (d) {
        return { label: d.label, piece: d.piece, avgTries: d.avgTries, runs: d.runs,
                 top: d.topTag ? w.PP.criteria.label(d.topTag) : '—' };
      })
    ));

    /* recent score cards */
    var cards = w.PP.stats.scoreCards(state, 10), card = el('div', { class: 'card' }, [el('h2', { text: '📋 Recent score cards' })]);
    if (!cards.length) {
      card.appendChild(el('p', { class: 'tiny muted', text: 'Nothing cleared yet.' }));
    } else {
      for (i = 0; i < cards.length; i++) { card.appendChild(reportRow(cards[i])); }
    }
    body.appendChild(card);
  }

  function reportRow(c) {
    var r = c.run, tags = [], k;
    for (k in r.tagCounts) {
      if (Object.prototype.hasOwnProperty.call(r.tagCounts, k)) {
        tags.push(w.PP.criteria.label(k) + ' ×' + r.tagCounts[k]);
      }
    }
    return el('div', { class: 'log-row' }, [
      el('div', { class: 'mark', text: c.sticker ? c.sticker.emoji : '⭐' }),
      el('div', { class: 'grow' }, [
        el('div', { text: c.section + ' — ' + ui.plural(r.passCount, 'try', 'tries') +
          (r.failCount === 0 ? ' (flawless)' : '') }),
        el('div', { class: 'tags', text: c.piece + (tags.length ? ' · ' + tags.join(', ') : '') })
      ]),
      el('div', { class: 'time', text: ui.fmtDate(r.completedAt) })
    ]);
  }

  function tile(n, k) {
    return el('div', { class: 'tile' }, [
      el('span', { class: 'n', text: n }), el('span', { class: 'k', text: k })
    ]);
  }

  /* Every chart ships with the same table fallback, one tap away. */
  function chartCard(title, why, chartNode, cols, rows) {
    var showing = false;
    var holder = el('div', { class: 'chart-surface' }, [chartNode]);
    var tableHolder = el('div');
    var toggle = el('button', { class: 'linkish' }, ['Show the numbers']);
    toggle.addEventListener('click', function () {
      showing = !showing;
      ui.clear(tableHolder);
      toggle.textContent = showing ? 'Hide the numbers' : 'Show the numbers';
      if (showing) { tableHolder.appendChild(w.PP.charts.table(cols, rows)); }
    }, false);

    return el('div', { class: 'chart-card' }, [
      el('h3', { text: title }),
      el('div', { class: 'why', text: why }),
      holder,
      el('div', { class: 'chart-foot' }, [el('div', { class: 'grow' }), toggle]),
      tableHolder
    ]);
  }

  /* ---- pieces -------------------------------------------------------- */
  function pieces(body, state, container) {
    var i, j, p, card, secs;
    for (i = 0; i < state.pieces.length; i++) {
      p = state.pieces[i];
      if (p.archived) { continue; }
      card = el('div', { class: 'card' });
      card.appendChild(el('div', { class: 'piece-title' }, [
        el('span', { class: 'emoji', text: p.emoji || '🎵' }),
        el('div', { class: 'grow' }, [
          el('h2', { text: p.name, style: 'margin:0' }),
          el('div', { class: 'tiny muted', text: p.composer || 'No composer set' })
        ]),
        el('button', { class: 'linkish', onclick: editPiece(p, container) }, ['Edit'])
      ]));

      secs = p.sections;
      for (j = 0; j < secs.length; j++) {
        if (secs[j].archived) { continue; }
        card.appendChild(sectionAdminRow(p, secs[j], container));
      }
      card.appendChild(el('button', {
        class: 'btn ghost small block', style: 'margin-top:8px',
        onclick: addSection(p, container)
      }, ['+ Add a bit']));
      body.appendChild(card);
    }

    body.appendChild(el('button', {
      class: 'btn block', onclick: addPiece(container)
    }, ['+ Add a piece']));

    var archived = [];
    for (i = 0; i < state.pieces.length; i++) { if (state.pieces[i].archived) { archived.push(state.pieces[i]); } }
    if (archived.length) {
      var ac = el('div', { class: 'card', style: 'margin-top:14px' }, [el('h3', { text: 'Put away' })]);
      for (i = 0; i < archived.length; i++) {
        (function (piece) {
          ac.appendChild(el('div', { class: 'toggle-row' }, [
            el('div', { class: 'grow tiny', text: piece.name }),
            el('button', {
              class: 'linkish',
              onclick: function () { piece.archived = false; w.PP.store.save(); render(container); }
            }, ['Bring back'])
          ]));
        })(archived[i]);
      }
      body.appendChild(ac);
    }
  }

  function sectionAdminRow(piece, section, container) {
    return el('div', { class: 'toggle-row' }, [
      el('div', { class: 'grow' }, [
        el('div', { style: 'font-weight:600;font-size:15px', text: (section.auto ? '🔍 ' : '') + section.label }),
        el('div', { class: 'tiny muted', text: (section.tempo ? '♩ = ' + section.tempo + ' · ' : '') +
          (section.notes || 'no note') })
      ]),
      el('button', { class: 'linkish', onclick: editSection(piece, section, container) }, ['Edit'])
    ]);
  }

  function addPiece(container) {
    return function () {
      ui.prompt({ title: 'New piece', body: 'What is it called?', ok: 'Add' }, function (name) {
        if (!name || !name.trim()) { return; }
        var state = w.PP.store.get();
        state.pieces.push({
          id: w.PP.store.uid('pc'), name: name.trim(), composer: '', emoji: '🎵',
          createdAt: Date.now(), archived: false, sections: []
        });
        w.PP.store.save();
        render(container);
      });
    };
  }

  function editPiece(piece, container) {
    return function () {
      ui.sheet(function (box, api) {
        var name = el('input', { type: 'text', value: piece.name });
        var composer = el('input', { type: 'text', value: piece.composer || '' });
        var emoji = el('input', { type: 'text', value: piece.emoji || '🎵', maxlength: '4' });
        box.appendChild(el('h2', { text: 'Edit piece' }));
        box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Name' }), name]));
        box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Composer' }), composer]));
        box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Emoji' }), emoji]));
        box.appendChild(el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn ghost', onclick: api.close }, ['Cancel']),
          el('button', {
            class: 'btn',
            onclick: function () {
              piece.name = name.value.trim() || piece.name;
              piece.composer = composer.value.trim();
              piece.emoji = emoji.value.trim() || '🎵';
              w.PP.store.save(); api.close(); render(container);
            }
          }, ['Save'])
        ]));
        box.appendChild(el('button', {
          class: 'btn ghost block', style: 'margin-top:10px',
          onclick: function () {
            api.close();
            ui.confirm({
              title: 'Put this piece away?',
              body: 'It disappears from her list. Everything already logged is kept, and you can bring it back later.',
              yes: 'Put away'
            }, function () { piece.archived = true; w.PP.store.save(); render(container); });
          }
        }, ['Put this piece away']));
      });
    };
  }

  function addSection(piece, container) {
    return function () { sectionSheet(piece, null, container); };
  }
  function editSection(piece, section, container) {
    return function () { sectionSheet(piece, section, container); };
  }

  function sectionSheet(piece, section, container) {
    ui.sheet(function (box, api) {
      var label = el('input', { type: 'text', value: section ? section.label : '', placeholder: 'e.g. bars 9–16, hands together' });
      var notes = el('textarea', { placeholder: 'What to watch for' });
      notes.value = section ? (section.notes || '') : '';
      var tempo = el('input', { type: 'tel', value: section && section.tempo ? String(section.tempo) : '', placeholder: 'e.g. 72' });

      box.appendChild(el('h2', { text: section ? 'Edit bit' : 'New bit' }));
      box.appendChild(el('p', { class: 'tiny muted', text:
        'Small bits clear fast and keep her winning. A whole piece is fine as the last bit of the list.' }));
      box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Name' }), label]));
      box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Note for her' }), notes]));
      box.appendChild(el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Target tempo (♩ per minute)' }), tempo]));

      box.appendChild(el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn ghost', onclick: api.close }, ['Cancel']),
        el('button', {
          class: 'btn',
          onclick: function () {
            var t = parseInt(tempo.value, 10);
            if (!label.value.trim()) { return; }
            if (section) {
              section.label = label.value.trim();
              section.notes = notes.value.trim();
              section.tempo = isNaN(t) ? null : t;
            } else {
              piece.sections.push({
                id: w.PP.store.uid('sc'), label: label.value.trim(), notes: notes.value.trim(),
                tempo: isNaN(t) ? null : t, archived: false, createdAt: Date.now(),
                auto: false, parentId: null
              });
            }
            w.PP.store.save(); api.close(); render(container);
          }
        }, ['Save'])
      ]));

      if (section) {
        box.appendChild(el('button', {
          class: 'btn ghost block', style: 'margin-top:10px',
          onclick: function () {
            api.close();
            ui.confirm({
              title: 'Put this bit away?',
              body: 'Her history for it is kept and still shows in reports.',
              yes: 'Put away'
            }, function () { section.archived = true; w.PP.store.save(); render(container); });
          }
        }, ['Put this bit away']));
      }
    });
  }

  /* ---- criteria ------------------------------------------------------ */
  function criteria(body, state, container) {
    body.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Which things can she tag?' }),
      el('p', { class: 'tiny muted', text:
        'These are the chips she taps after an imperfect pass. Start with a handful — too many choices ' +
        'and an eight-year-old taps whatever is first. Add the subtler ones (balance, phrasing, pedal) ' +
        'as her ear grows.' })
    ]));

    var groups = w.PP.criteria.GROUPS, gi, ci, list, card;
    for (gi = 0; gi < groups.length; gi++) {
      card = el('div', { class: 'card' }, [
        el('h3', { text: groups[gi].emoji + '  ' + groups[gi].label })
      ]);
      list = w.PP.criteria.ALL.filter(function (c) { return c.group === groups[gi].id; });
      for (ci = 0; ci < list.length; ci++) {
        card.appendChild(criterionToggle(state, list[ci], container));
      }
      body.appendChild(card);
    }
  }

  function criterionToggle(state, crit, container) {
    var on = state.settings.activeCriteria.indexOf(crit.id) >= 0;
    var sw = el('button', { class: 'switch' + (on ? ' on' : ''), 'aria-label': crit.label }, [el('span', { class: 'knob' })]);
    sw.addEventListener('click', function () {
      var idx = state.settings.activeCriteria.indexOf(crit.id);
      if (idx >= 0) { state.settings.activeCriteria.splice(idx, 1); }
      else { state.settings.activeCriteria.push(crit.id); }
      w.PP.store.save();
      sw.className = 'switch' + (state.settings.activeCriteria.indexOf(crit.id) >= 0 ? ' on' : '');
    }, false);

    return el('div', { class: 'toggle-row' }, [
      el('div', { class: 'grow' }, [
        el('div', { style: 'font-weight:600;font-size:15px', text: crit.emoji + '  ' + crit.label }),
        el('div', { class: 'tiny muted', text: crit.hint })
      ]),
      sw
    ]);
  }

  /* ---- settings ------------------------------------------------------ */
  function settings(body, state, container) {
    var name = el('input', { type: 'text', value: state.child.name, placeholder: 'Her name' });
    name.addEventListener('change', function () {
      state.child.name = name.value.trim(); w.PP.store.save();
    }, false);

    var goal = el('select');
    [2, 3, 4, 5].forEach(function (n) {
      var o = el('option', { value: String(n), text: n + ' in a row' });
      if (state.settings.streakGoal === n) { o.setAttribute('selected', 'selected'); }
      goal.appendChild(o);
    });
    goal.addEventListener('change', function () {
      state.settings.streakGoal = parseInt(goal.value, 10); w.PP.store.save();
      ui.toast('Runs already in progress keep their old goal.');
    }, false);

    var coach = el('select');
    [3, 4, 5, 6, 8, 0].forEach(function (n) {
      var o = el('option', { value: String(n), text: n === 0 ? 'Never' : 'After ' + n + ' resets' });
      if (state.settings.coachAfter === n) { o.setAttribute('selected', 'selected'); }
      coach.appendChild(o);
    });
    coach.addEventListener('change', function () {
      state.settings.coachAfter = parseInt(coach.value, 10); w.PP.store.save();
    }, false);

    body.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Practice rules' }),
      el('label', { class: 'field' }, [el('span', { class: 'lab', text: 'Her name' }), name]),
      el('label', { class: 'field' }, [
        el('span', { class: 'lab', text: 'A bit is cleared after' }), goal
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'lab', text: 'Coach offers help' }), coach
      ]),
      el('p', { class: 'tiny muted', text:
        'The coach never ends the work — it offers a slower tempo, a smaller bit, or a break, and logs which she chose.' })
    ]));

    body.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'On the iPad' }),
      toggleRow('Sounds', 'A chime for a star, a fanfare for a cleared streak.', state.settings.sound, function (v) {
        state.settings.sound = v; w.PP.store.save();
      }),
      el('div', { class: 'toggle-row' }, [
        el('div', { class: 'grow' }, [
          el('div', { style: 'font-weight:600;font-size:15px', text: 'Parent PIN' }),
          el('div', { class: 'tiny muted', text: 'Four digits. Keeps her out of the reports and setup.' })
        ]),
        el('button', { class: 'linkish', onclick: function () { changePin(container); } }, ['Change'])
      ])
    ]));
  }

  function toggleRow(title, hint, value, onChange) {
    var sw = el('button', { class: 'switch' + (value ? ' on' : ''), 'aria-label': title }, [el('span', { class: 'knob' })]);
    var v = value;
    sw.addEventListener('click', function () {
      v = !v;
      sw.className = 'switch' + (v ? ' on' : '');
      onChange(v);
    }, false);
    return el('div', { class: 'toggle-row' }, [
      el('div', { class: 'grow' }, [
        el('div', { style: 'font-weight:600;font-size:15px', text: title }),
        el('div', { class: 'tiny muted', text: hint })
      ]),
      sw
    ]);
  }

  function changePin(container) {
    ui.prompt({
      title: 'New parent PIN', body: 'Four digits.', numeric: true, pin: true, maxlength: 4, ok: 'Save PIN',
      validate: function (v) { return /^\d{4}$/.test(v) ? null : 'Four digits, please.'; }
    }, function (v) {
      w.PP.store.setPin(v);
      ui.toast('PIN updated.');
      render(container);
    });
  }

  /* ---- data ---------------------------------------------------------- */
  function data(body, state, container) {
    body.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Get the data out' }),
      el('p', { class: 'tiny muted', text:
        'Every pass is stored with its timestamp and the criteria she tagged. iPadOS 12 cannot download ' +
        'files from a web app, so each export also shows the text — tap "Copy" and paste it into an email to yourself.' }),
      el('div', { class: 'btn-row', style: 'margin-top:10px' }, [
        el('button', { class: 'btn ghost', onclick: function () {
          showExport('practice-passes.csv', 'text/csv', w.PP.stats.passesCsv(state),
            'One row per pass: time, piece, bit, perfect or not, and every criterion she tagged.');
        } }, ['Passes CSV']),
        el('button', { class: 'btn ghost', onclick: function () {
          showExport('practice-streaks.csv', 'text/csv', w.PP.stats.runsCsv(state),
            'One row per streak attempt: how many tries it took and what went wrong along the way.');
        } }, ['Streaks CSV'])
      ]),
      el('button', { class: 'btn block', style: 'margin-top:10px', onclick: function () {
        showExport('piano-practice-backup.json', 'application/json', JSON.stringify(w.PP.store.get()),
          'A full backup: pieces, every pass, stickers and badges. This is what "Restore" reads back in.');
      } }, ['💾 Full backup (JSON)'])
    ]));

    body.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Restore a backup' }),
      el('p', { class: 'tiny muted', text: 'Paste a backup here. It replaces everything currently on this iPad.' }),
      restoreBox(container)
    ]));

    body.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Start over' }),
      el('p', { class: 'tiny muted', text: 'Deletes every piece, pass, sticker and badge on this device. Back up first.' }),
      el('button', {
        class: 'btn danger block', onclick: function () {
          ui.confirm({
            title: 'Erase everything?',
            body: 'All of her practice history on this iPad will be gone. This cannot be undone.',
            yes: 'Erase it all', danger: true
          }, function () {
            w.PP.store.reset();
            ui.toast('Cleared.');
            w.PP.app.go('home');
          });
        }
      }, ['Erase all data'])
    ]));

    body.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'Where the data lives' }),
      el('p', { class: 'tiny muted', text:
        'Everything is stored on this iPad in this app only — nothing is sent anywhere, and there is no account. ' +
        'That also means a cleared Safari cache takes it with it, so take a backup now and then.' })
    ]));
  }

  function showExport(filename, mime, text, blurb) {
    ui.sheet(function (box, api) {
      var area = el('textarea', { style: 'min-height:180px;font-family:monospace;font-size:12px' });
      area.value = text;
      box.appendChild(el('h2', { text: filename }));
      box.appendChild(el('p', { class: 'tiny muted', text: blurb }));
      box.appendChild(el('p', { class: 'tiny muted', text: Math.round(text.length / 1024) + ' KB · ' +
        (text.split('\n').length - 1) + ' rows' }));
      box.appendChild(el('label', { class: 'field' }, [area]));

      var row = el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn ghost', onclick: function () {
          area.focus();
          try { area.setSelectionRange(0, area.value.length); } catch (e) {}
          var copied = false;
          try { copied = w.document.execCommand('copy'); } catch (e2) { copied = false; }
          ui.toast(copied ? 'Copied. Paste it into an email.' : 'Selected — now tap Copy on the keyboard bar.');
        } }, ['Copy']),
        el('button', { class: 'btn', onclick: api.close }, ['Done'])
      ]);
      box.appendChild(row);

      /* On a desktop browser a real download is nicer; iOS 12 ignores it. */
      if (supportsDownload()) {
        var url = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(text);
        box.appendChild(el('a', {
          class: 'btn ghost block', style: 'margin-top:10px;text-decoration:none',
          href: url, download: filename
        }, ['Download ' + filename]));
      }
    });
  }

  function supportsDownload() {
    var a = w.document.createElement('a');
    return typeof a.download !== 'undefined';
  }

  function restoreBox(container) {
    var area = el('textarea', { placeholder: 'Paste the backup JSON here', style: 'font-family:monospace;font-size:12px' });
    var wrap = el('div', {}, [
      el('label', { class: 'field' }, [area]),
      el('button', {
        class: 'btn ghost block', onclick: function () {
          var parsed;
          try { parsed = JSON.parse(area.value); }
          catch (e) { ui.toast('That is not a backup file.'); return; }
          ui.confirm({
            title: 'Replace everything?',
            body: 'The practice history on this iPad will be swapped for the backup.',
            yes: 'Restore', danger: true
          }, function () {
            w.PP.store.replace(parsed);
            var s = w.PP.store.get();
            w.PP.badges.evaluate(s, Date.now());
            w.PP.store.save();
            ui.toast('Restored ' + s.passes.length + ' passes.');
            render(container);
          });
        }
      }, ['Restore from this text'])
    ]);
    return wrap;
  }

  w.PP.viewParent = {
    render: render,
    lock: function () { unlocked = false; }
  };
})(window);
