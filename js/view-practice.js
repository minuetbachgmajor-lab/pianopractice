/* The practice screen: play a pass, judge it yourself, log it.
 *
 * The whole point of the design is that SHE decides whether a pass was
 * perfect, and if it was not, she names what happened. Nothing here scolds. */
(function (w) {
  'use strict';

  var el = w.PP.ui.el, ui = w.PP.ui;

  var PRAISE = [
    'Beautiful!', 'That was clean!', 'Lovely playing!', 'Yes! Keep it going!',
    'One more like that!', 'Sparkling!', 'Your teacher would smile.'
  ];
  var KIND_WORDS = [
    'Good catch — noticing it is the hard part.',
    'Spotting it means you can fix it.',
    'Honest ears! Back to zero, no big deal.',
    'Every player does this. Try again.',
    'Nice listening. Let us go again.'
  ];

  /* What the coach says depends on what she keeps catching. */
  var COACH_TIPS = {
    wrong_note:  'Play just the tricky bar, very slowly, and say the note names out loud.',
    rhythm:      'Clap the rhythm first without the piano, counting out loud.',
    fingering:   'Do it three times with no sound at all — just the right fingers on the keys.',
    hand_shape:  'Pretend you are holding a bubble. Round fingers, soft wrist.',
    stopped:     'Try the two bars around the stopping place, joined together, very slowly.',
    hesitated:   'Look one bar ahead of where your hands are playing.',
    restarted:   'If it wobbles, keep going anyway — finishing counts.',
    rushed:      'Set a slower speed and count out loud. Slow is smooth, smooth is fast.',
    dragged:     'Feel the beat in your feet before you start.',
    dynamics:    'Sing the loud and soft bits first, then play them.',
    articulation:'Say "smooooth" or "bounce" as you play each phrase.',
    tone_harsh:  'Drop into the key with a heavy arm and a soft hand. Warm, not bangy.',
    memory_slip: 'Look at the music for this one. Memory comes after the fingers know it.',
    soft_tone:   'Rest your finger on the key first, then press. No hitting from above.',
    singing:     'Sing the melody out loud, then play it the way you sang it.',
    legato:      'Keep the first finger down until the next one is already sounding.',
    staccato:    'Bounce off the key like it is hot. Short, light, from the wrist.',
    slur_end:    'Lean into the first note of the slur and float off the last one.',
    breath:      'Mark the breaths in pencil, then breathe out loud as you play.',
    breath_place:'Find where the phrase ends first. Breathe there and nowhere else.',
    phrase_shape:'Play the phrase getting louder to the middle and softer to the end.',
    wrist_rotate:'Let the wrist roll side to side, like turning a doorknob gently.',
    arm_circle:  'Draw a little circle with the elbow as the phrase ends.',
    lift:        'Float the hand up off the keys at the end, like a bird taking off.',
    hands_together: 'Play just the first chord of each bar, hands together, until they land as one.',
    tense_hands: 'Shake the hands out, then play again with floppy wrists.',
    start_tempo: 'Find the hardest bar, play that first, and start the whole thing at that speed.',
    tempo_hold:  'Count the first bar out loud before you start, and keep that pulse.',
    balance:     'Play the melody hand alone, then add the other hand at half its volume.',
    pedal:       'Change the pedal just after your hands land, not with them.'
  };

  var state, sectionId, mount, coachDismissedRun;

  function render(container, id) {
    state = w.PP.store.get();
    sectionId = id;
    mount = container;
    coachDismissedRun = null;
    draw();
  }

  function draw() {
    var found = w.PP.store.findSection(state, sectionId);
    ui.clear(mount);
    if (!found) {
      mount.appendChild(el('div', { class: 'empty-note' }, [
        el('span', { class: 'e', text: '🎹' }),
        el('p', { text: 'That bit is not here any more.' }),
        el('button', { class: 'btn', onclick: function () { w.PP.app.go('home'); } }, ['Back to my pieces'])
      ]));
      return;
    }

    var piece = found.piece, section = found.section;
    var run = w.PP.engine.activeRun(state, sectionId);
    var goal = state.settings.streakGoal;
    var streak = run ? run.streak : 0;

    /* header */
    mount.appendChild(el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: function () { w.PP.app.go('home'); } }, ['‹']),
      el('div', { class: 'grow', style: 'margin-left:10px' }, [
        el('h1', { text: section.label, style: 'font-size:20px' }),
        el('div', { class: 'sub', text: piece.name + (section.tempo ? ' · ♩ = ' + section.tempo : '') })
      ])
    ]));

    if (section.notes) {
      mount.appendChild(el('div', { class: 'card tight' }, [
        el('div', { class: 'tiny muted', text: '📌 ' + section.notes })
      ]));
    }

    /* the streak */
    var starsWrap = el('div', { class: 'stars' });
    var i, star;
    for (i = 0; i < goal; i++) {
      star = el('div', { class: 'star' + (i < streak ? ' lit' : ''), text: i < streak ? '⭐' : '☆' });
      starsWrap.appendChild(star);
    }
    var caption = streak === 0
      ? (run && run.passCount ? 'Back to zero. Ready when you are.' : 'Play it once, then tell me how it went.')
      : (streak === goal - 1 ? 'One more perfect one!' : streak + ' in a row! Keep going.');

    mount.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'streak-wrap' }, [
        starsWrap,
        el('div', { class: 'streak-caption', text: caption }),
        el('div', { class: 'streak-sub', text: run && run.passCount
          ? ui.plural(run.passCount, 'try', 'tries') + ' this time'
          : 'Three perfect in a row clears this bit.' })
      ]),
      el('div', { class: 'judge', style: 'margin-top:14px' }, [
        el('button', { class: 'perfect', onclick: onPerfect }, [
          el('span', { class: 'big', text: '⭐' }),
          el('span', { text: 'Perfect!' }),
          el('span', { class: 'cap', text: 'Nothing to fix' })
        ]),
        el('button', { class: 'oops', onclick: onOops }, [
          el('span', { class: 'big', text: '🙃' }),
          el('span', { text: 'Oops' }),
          el('span', { class: 'cap', text: 'Something slipped' })
        ])
      ])
    ]));

    if (run && run.failCount >= state.settings.coachAfter && coachDismissedRun !== run.id) {
      mount.appendChild(coachCard(run, section));
    }

    mount.appendChild(logCard());
  }

  /* ---- judging ----------------------------------------------------- */

  function onPerfect() {
    var fx = w.PP.engine.recordPass(state, { sectionId: sectionId, ok: true });
    ui.sounds.star();
    if (fx.completed) {
      celebrate(fx);
    } else {
      draw();
      popLastStar();
      ui.toast(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    }
  }

  function popLastStar() {
    var stars = mount.querySelectorAll('.star.lit');
    if (stars.length) { stars[stars.length - 1].className = 'star lit pop'; }
  }

  function onOops() {
    var chosen = {};
    ui.sheet(function (box, api) {
      var assigned = w.PP.criteria.resolveFor(state, sectionId);
      var source = w.PP.criteria.sourceFor(state, sectionId);

      box.appendChild(el('h2', { text: 'What happened?' }));
      box.appendChild(el('p', { class: 'muted tiny', text:
        'Tap everything you noticed. You can tap none if you are not sure.' }));

      if (!assigned.length) {
        box.appendChild(el('p', { class: 'muted', text:
          'Nothing is set up to listen for yet. A grown-up can choose what this bit is working on.' }));
      }
      box.appendChild(chipSection(assigned, chosen,
        source === 'default' ? null : 'Working on', assigned.length <= 6));

      /* The rest of the library stays one tap away: the assigned list keeps
       * her focused, but never stops her naming something real. */
      var rest = restOfLibrary(assigned);
      var more = el('div');
      box.appendChild(more);
      if (rest.length) {
        var moreBtn = el('button', { class: 'linkish', style: 'margin-top:12px' },
          ['Something else? (' + rest.length + ' more)']);
        moreBtn.addEventListener('click', function () {
          if (moreBtn.parentNode) { moreBtn.parentNode.removeChild(moreBtn); }
          more.appendChild(chipSection(rest, chosen, 'Everything else'));
        }, false);
        box.appendChild(moreBtn);
      }

      var note = el('input', { type: 'text', placeholder: 'Anything else? (optional)' });
      box.appendChild(el('label', { class: 'field', style: 'margin-top:14px' }, [note]));

      box.appendChild(el('div', { class: 'btn-row sheet-actions' }, [
        el('button', { class: 'btn ghost', onclick: api.close }, ['Never mind']),
        el('button', {
          class: 'btn pink',
          onclick: function () {
            api.close();
            logOops(keys(chosen), note.value);
          }
        }, ['Log it'])
      ]));
    });
  }

  /* Renders a set of criteria ids in library order. A short assigned list
   * drops the group headings — four chips under four headings is mostly
   * whitespace, and this sheet has to fit on one screen at the piano. */
  function chipSection(ids, chosen, heading, flat) {
    var wrap = el('div'), groups = w.PP.criteria.GROUPS, gi, ci, list, chipsWrap;
    if (heading && ids.length) {
      wrap.appendChild(el('div', { class: 'chip-group-title', style: 'margin-top:14px', text: heading }));
    }
    if (flat) {
      chipsWrap = el('div', { class: 'chips' });
      for (gi = 0; gi < groups.length; gi++) {
        list = idsInGroup(ids, groups[gi].id);
        for (ci = 0; ci < list.length; ci++) { chipsWrap.appendChild(makeChip(list[ci], chosen)); }
      }
      wrap.appendChild(chipsWrap);
      return wrap;
    }
    for (gi = 0; gi < groups.length; gi++) {
      list = idsInGroup(ids, groups[gi].id);
      if (!list.length) { continue; }
      wrap.appendChild(el('div', { class: 'chip-group-title', text: groups[gi].emoji + '  ' + groups[gi].label }));
      chipsWrap = el('div', { class: 'chips' });
      for (ci = 0; ci < list.length; ci++) { chipsWrap.appendChild(makeChip(list[ci], chosen)); }
      wrap.appendChild(chipsWrap);
    }
    return wrap;
  }

  function idsInGroup(ids, groupId) {
    var out = [], i, c;
    for (i = 0; i < ids.length; i++) {
      c = w.PP.criteria.get(ids[i]);
      if (c && c.group === groupId) { out.push(c); }
    }
    return out;
  }

  function restOfLibrary(assigned) {
    var all = w.PP.criteria.library(), out = [], i;
    for (i = 0; i < all.length; i++) {
      if (assigned.indexOf(all[i].id) < 0) { out.push(all[i].id); }
    }
    return out;
  }

  function makeChip(crit, chosen) {
    var btn = el('button', { class: 'chip' }, [
      el('span', { class: 'e', text: crit.emoji }),
      el('span', { class: 'l', text: crit.label }),
      el('span', { class: 'h', text: crit.hint })
    ]);
    btn.addEventListener('click', function () {
      if (chosen[crit.id]) { delete chosen[crit.id]; btn.className = 'chip'; }
      else { chosen[crit.id] = true; btn.className = 'chip on'; }
    }, false);
    return btn;
  }

  function keys(obj) {
    var out = [], k;
    for (k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) { out.push(k); } }
    return out;
  }

  function logOops(tags, note) {
    var fx = w.PP.engine.recordPass(state, { sectionId: sectionId, ok: false, tags: tags, note: note });
    ui.sounds.oops();
    draw();
    shakeStars();
    ui.toast(KIND_WORDS[Math.floor(Math.random() * KIND_WORDS.length)]);
    if (fx.coach) { scrollToCoach(); }
  }

  function shakeStars() {
    var wrap = mount.querySelector('.stars');
    if (!wrap) { return; }
    wrap.className = 'stars shake';
    setTimeout(function () { if (wrap) { wrap.className = 'stars'; } }, 500);
  }

  function scrollToCoach() {
    var card = mount.querySelector('.coach');
    if (card && card.scrollIntoView) { card.scrollIntoView(false); }
  }

  /* ---- coach ------------------------------------------------------- */

  function coachCard(run, section) {
    var tag = w.PP.engine.topTag(run);
    var tip = (tag && COACH_TIPS[tag]) || 'Try it at half speed, hands separately first.';
    var card = el('div', { class: 'coach' }, [
      el('h3', { text: '🌱 This bit is tricky!' }),
      el('p', { class: 'tiny', text: 'You have gone back to zero ' + ui.plural(run.failCount, 'time') +
        (tag ? ' — mostly ' + w.PP.criteria.label(tag).toLowerCase() + '.' : '.') }),
      el('p', { style: 'font-weight:600', text: tip }),
      el('div', { class: 'btn-row three', style: 'margin-top:10px' }, [
        el('button', { class: 'btn ghost small', onclick: onSlower }, ['🐢 Go slower']),
        el('button', { class: 'btn ghost small', onclick: onSmaller }, ['🔍 Make it smaller']),
        el('button', { class: 'btn ghost small', onclick: onLater }, ['👋 Come back later'])
      ]),
      el('button', {
        class: 'linkish', style: 'margin-top:6px',
        onclick: function () { coachDismissedRun = run.id; draw(); }
      }, ['No thanks, I want to keep trying 💪'])
    ]);
    return card;
  }

  function onSlower() {
    var found = w.PP.store.findSection(state, sectionId);
    var current = (found && found.section.tempo) || null;
    ui.prompt({
      title: 'Slow it down 🐢',
      body: current
        ? 'The target is ♩ = ' + current + '. Practising slower is not cheating — it is how the hard bits get easy.'
        : 'Pick a speed that feels easy and safe.',
      numeric: true,
      value: current ? String(Math.round(current * 0.75)) : '60',
      ok: 'Set practice speed'
    }, function (v) {
      var n = parseInt(v, 10);
      w.PP.engine.logCoach(state, sectionId, 'slow', isNaN(n) ? '' : String(n));
      coachDismissedRun = w.PP.engine.activeRun(state, sectionId) ? w.PP.engine.activeRun(state, sectionId).id : null;
      draw();
      ui.toast(isNaN(n) ? 'Nice and slow now.' : 'Practice speed ♩ = ' + n + '. Off you go!');
    });
  }

  function onSmaller() {
    var child = w.PP.engine.shrinkSection(state, sectionId);
    if (!child) { return; }
    ui.prompt({
      title: 'Which small bit?',
      body: 'Give the tricky little piece a name, like "bars 9 to 10" or "the left hand jump".',
      value: child.label,
      ok: 'Practise this'
    }, function (v) {
      if (v && v.trim()) { child.label = v.trim(); }
      w.PP.store.save();
      w.PP.app.go('practice', child.id);
      ui.toast('Small bits get cleared fast 🔍');
    });
  }

  function onLater() {
    w.PP.engine.logCoach(state, sectionId, 'park', '');
    ui.toast('Parked for now. Nice work sticking with it 👋');
    w.PP.app.go('home');
  }

  /* ---- today's score card strip ------------------------------------ */

  function logCard() {
    var todayKey = w.PP.badges.dayKey(Date.now());
    var rows = [], i, p;
    for (i = state.passes.length - 1; i >= 0; i--) {
      p = state.passes[i];
      if (p.sectionId !== sectionId) { continue; }
      if (w.PP.badges.dayKey(p.ts) !== todayKey) { continue; }
      rows.push(p);
      if (rows.length >= 12) { break; }
    }

    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'card-head' }, [
      el('div', { class: 'grow' }, [el('h2', { text: '📋 Today’s score card' })]),
      rows.length ? el('button', { class: 'linkish', onclick: onUndo }, ['Undo last']) : null
    ]));

    if (!rows.length) {
      card.appendChild(el('div', { class: 'empty-note tiny' }, [
        el('span', { class: 'e', text: '🎵' }),
        'Every try you log shows up here with the time.'
      ]));
      return card;
    }

    for (i = 0; i < rows.length; i++) { card.appendChild(logRow(rows[i])); }
    return card;
  }

  function logRow(p) {
    var labels = [], j;
    for (j = 0; j < p.tags.length; j++) {
      labels.push(w.PP.criteria.emoji(p.tags[j]) + ' ' + w.PP.criteria.label(p.tags[j]));
    }
    return el('div', { class: 'log-row' }, [
      el('div', { class: 'mark', text: p.ok ? '⭐' : '🙃' }),
      el('div', { class: 'grow' }, [
        el('div', { text: p.ok ? 'Perfect' : (labels.length ? 'Oops' : 'Oops (not sure what)') }),
        labels.length ? el('div', { class: 'tags', text: labels.join(' · ') }) : null,
        p.note ? el('div', { class: 'tags', text: '“' + p.note + '”' }) : null
      ]),
      el('div', { class: 'time', text: ui.fmtTime(p.ts) })
    ]);
  }

  function onUndo() {
    if (w.PP.engine.undoLastPass(state)) {
      draw();
      ui.toast('Took that one back.');
    } else {
      ui.toast('That one is already in the sticker book!');
    }
  }

  /* ---- celebration ------------------------------------------------- */

  function celebrate(fx) {
    ui.sounds.clear();
    ui.confetti(60);
    draw();
    var run = fx.run, sticker = fx.sticker;
    var found = w.PP.store.findSection(state, sectionId);

    ui.modal(function (box, api) {
      box.appendChild(scoreCardNode(run, sticker, found));

      if (fx.newBadges.length) {
        var list = el('div', { class: 'badge-grid', style: 'margin-top:14px' }), i, b;
        for (i = 0; i < fx.newBadges.length; i++) {
          b = w.PP.badges.get(fx.newBadges[i]);
          if (!b) { continue; }
          list.appendChild(el('div', { class: 'badge' }, [
            el('span', { class: 'e', text: b.emoji }),
            el('span', { class: 'n', text: b.name }),
            el('span', { class: 'b', text: b.blurb })
          ]));
        }
        box.appendChild(el('h3', { style: 'margin-top:16px', text: '🎉 New badge!' }));
        box.appendChild(list);
        ui.sounds.badge();
      }

      var next = nextSection(found);
      box.appendChild(el('div', { class: 'btn-row', style: 'margin-top:16px' }, [
        el('button', { class: 'btn ghost', onclick: function () { api.close(); w.PP.app.go('home'); } }, ['My pieces']),
        next
          ? el('button', { class: 'btn mint', onclick: function () { api.close(); w.PP.app.go('practice', next.id); } }, ['Next bit →'])
          : el('button', { class: 'btn mint', onclick: function () { api.close(); draw(); } }, ['Play it again'])
      ]));
    });
  }

  function scoreCardNode(run, sticker, found) {
    var clean = run.failCount === 0;
    var tagRows = [], k, top = w.PP.engine.topTag(run);
    for (k in run.tagCounts) {
      if (Object.prototype.hasOwnProperty.call(run.tagCounts, k)) {
        tagRows.push(w.PP.criteria.emoji(k) + ' ' + w.PP.criteria.label(k) + ' ×' + run.tagCounts[k]);
      }
    }
    return el('div', { class: 'scorecard' + (clean ? ' golden' : '') }, [
      el('div', { class: 'big-sticker', text: sticker ? sticker.emoji : '⭐' }),
      el('div', { class: 'title', text: clean ? 'Flawless!' : 'You did it!' }),
      el('div', { class: 'where', text: (found ? found.piece.name + ' · ' + found.section.label : '') }),
      el('div', { class: 'stats' }, [
        el('div', { class: 'stat' }, [
          el('span', { class: 'n', text: String(run.goal) }), el('span', { class: 'k', text: 'in a row' })
        ]),
        el('div', { class: 'stat' }, [
          el('span', { class: 'n', text: String(run.passCount) }), el('span', { class: 'k', text: 'tries' })
        ]),
        el('div', { class: 'stat' }, [
          el('span', { class: 'n', text: ui.fmtDuration(run.ms) }), el('span', { class: 'k', text: 'taken' })
        ])
      ]),
      el('div', { class: 'tagline', text: clean
        ? 'Three perfect passes, no mistakes at all. Golden sticker earned.'
        : (top ? 'You caught "' + w.PP.criteria.label(top).toLowerCase() + '" the most — and then you fixed it.'
               : 'You kept going until it was right.') }),
      tagRows.length ? el('div', { class: 'tagline', style: 'margin-top:6px', text: tagRows.join('  ·  ') }) : null
    ]);
  }

  function nextSection(found) {
    if (!found) { return null; }
    var list = found.piece.sections, i, idx = -1;
    for (i = 0; i < list.length; i++) { if (list[i].id === found.section.id) { idx = i; } }
    for (i = idx + 1; i < list.length; i++) {
      if (!list[i].archived && !w.PP.engine.clearedToday(state, list[i].id)) { return list[i]; }
    }
    for (i = 0; i < list.length; i++) {
      if (i !== idx && !list[i].archived && !w.PP.engine.clearedToday(state, list[i].id)) { return list[i]; }
    }
    return null;
  }

  w.PP.viewPractice = { render: render, scoreCardNode: scoreCardNode };
})(window);
