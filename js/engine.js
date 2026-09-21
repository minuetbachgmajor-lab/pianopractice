/* The practice rule.
 *
 *   Three perfect passes in a row clears the section.
 *   One imperfect pass sends the count back to zero.
 *
 * A "run" is one attempt at clearing a section: it opens on the first pass
 * and closes the moment the streak goal is reached, so run.passCount is the
 * honest "how many tries did that take" number the reports are built on. */
(function (w) {
  'use strict';

  var SESSION_GAP_MS = 45 * 60 * 1000;   /* a gap this long starts a new session */
  var MAX_GAP_MS = 2 * 60 * 1000;        /* time between passes, capped so a tea break is not "practice" */

  function ensureSession(state, now) {
    var last = state.sessions.length ? state.sessions[state.sessions.length - 1] : null;
    if (last && (now - (last.lastActivityAt || last.startedAt)) < SESSION_GAP_MS) {
      last.lastActivityAt = now;
      return last;
    }
    var s = {
      id: w.PP.store.uid('ss'),
      startedAt: now,
      lastActivityAt: now,
      activeMs: 0
    };
    state.sessions.push(s);
    return s;
  }

  function activeRun(state, sectionId) {
    var i;
    for (i = state.runs.length - 1; i >= 0; i--) {
      if (state.runs[i].sectionId === sectionId && !state.runs[i].completedAt) {
        return state.runs[i];
      }
    }
    return null;
  }

  function openRun(state, sectionId, sessionId, now) {
    var found = w.PP.store.findSection(state, sectionId);
    var run = {
      id: w.PP.store.uid('rn'),
      sessionId: sessionId,
      pieceId: found ? found.piece.id : null,
      sectionId: sectionId,
      startedAt: now,
      completedAt: null,
      passCount: 0,
      failCount: 0,
      streak: 0,
      tagCounts: {},
      ms: 0,
      stickerId: null,
      goal: state.settings.streakGoal
    };
    state.runs.push(run);
    return run;
  }

  function lastPassTs(state, runId) {
    var i;
    for (i = state.passes.length - 1; i >= 0; i--) {
      if (state.passes[i].runId === runId) { return state.passes[i].ts; }
    }
    return null;
  }

  /* Record one pass. Returns the effects the UI needs to celebrate or coach. */
  function recordPass(state, opts) {
    var now = opts.now || Date.now();
    var session = ensureSession(state, now);
    var run = activeRun(state, opts.sectionId) || openRun(state, opts.sectionId, session.id, now);
    var prevTs = lastPassTs(state, run.id);
    var tags = opts.ok ? [] : (opts.tags || []).slice();
    var i, t;

    session.lastActivityAt = now;
    run.passCount += 1;

    if (opts.ok) {
      run.streak += 1;
    } else {
      run.streak = 0;
      run.failCount += 1;
      for (i = 0; i < tags.length; i++) {
        t = tags[i];
        run.tagCounts[t] = (run.tagCounts[t] || 0) + 1;
      }
    }

    var pass = {
      id: w.PP.store.uid('ps'),
      ts: now,
      sessionId: session.id,
      runId: run.id,
      pieceId: run.pieceId,
      sectionId: run.sectionId,
      ok: !!opts.ok,
      tags: tags,
      note: opts.note || '',
      attemptInRun: run.passCount,
      streakAfter: run.streak,
      gapMs: prevTs === null ? 0 : Math.min(now - prevTs, MAX_GAP_MS)
    };
    state.passes.push(pass);

    var goal = run.goal || state.settings.streakGoal;
    var effects = {
      pass: pass,
      run: run,
      session: session,
      streak: run.streak,
      goal: goal,
      completed: false,
      sticker: null,
      newBadges: [],
      coach: null
    };

    if (run.streak >= goal) {
      run.completedAt = now;
      run.ms = now - run.startedAt;
      var art = w.PP.stickers.pick(run.id, run.failCount === 0);
      var sticker = {
        id: w.PP.store.uid('st'),
        ts: now,
        runId: run.id,
        pieceId: run.pieceId,
        sectionId: run.sectionId,
        emoji: art.emoji,
        tint: art.tint,
        golden: art.golden
      };
      state.stickers.push(sticker);
      run.stickerId = sticker.id;
      effects.completed = true;
      effects.sticker = sticker;
    } else if (!opts.ok && state.settings.coachAfter > 0 &&
               run.failCount >= state.settings.coachAfter &&
               run.failCount % state.settings.coachAfter === 0) {
      effects.coach = { runId: run.id, sectionId: run.sectionId, failCount: run.failCount, topTag: topTag(run) };
    }

    effects.newBadges = w.PP.badges.evaluate(state, now);
    w.PP.store.save();
    return effects;
  }

  function topTag(run) {
    var best = null, bestN = 0, k;
    for (k in run.tagCounts) {
      if (Object.prototype.hasOwnProperty.call(run.tagCounts, k) && run.tagCounts[k] > bestN) {
        bestN = run.tagCounts[k];
        best = k;
      }
    }
    return best;
  }

  /* Undo the most recent pass — for the inevitable fat-finger tap. Only the
   * last one, and only if it did not already close a run. */
  function undoLastPass(state) {
    if (!state.passes.length) { return false; }
    var pass = state.passes[state.passes.length - 1];
    var run = null, i, t;
    for (i = 0; i < state.runs.length; i++) { if (state.runs[i].id === pass.runId) { run = state.runs[i]; } }
    if (!run || run.completedAt) { return false; }

    state.passes.pop();
    run.passCount -= 1;
    if (pass.ok) {
      run.streak = Math.max(0, run.streak - 1);
    } else {
      run.failCount = Math.max(0, run.failCount - 1);
      for (i = 0; i < pass.tags.length; i++) {
        t = pass.tags[i];
        run.tagCounts[t] = Math.max(0, (run.tagCounts[t] || 0) - 1);
        if (!run.tagCounts[t]) { delete run.tagCounts[t]; }
      }
      /* rebuild the streak from what is left of this run */
      run.streak = 0;
      for (i = 0; i < state.passes.length; i++) {
        if (state.passes[i].runId !== run.id) { continue; }
        run.streak = state.passes[i].ok ? run.streak + 1 : 0;
      }
    }
    if (run.passCount <= 0) {
      for (i = state.runs.length - 1; i >= 0; i--) {
        if (state.runs[i].id === run.id) { state.runs.splice(i, 1); break; }
      }
    }
    w.PP.store.save();
    return true;
  }

  function logCoach(state, sectionId, kind, detail) {
    state.coachEvents.push({
      id: w.PP.store.uid('cv'),
      ts: Date.now(),
      sectionId: sectionId,
      kind: kind,
      detail: detail || ''
    });
    w.PP.store.save();
  }

  /* "Make it smaller" creates a guided child section under the one she is
   * stuck on. She cannot invent pieces, but she can always shrink the target. */
  function shrinkSection(state, sectionId) {
    var found = w.PP.store.findSection(state, sectionId);
    if (!found) { return null; }
    var parent = found.section;
    var n = 1, i;
    for (i = 0; i < found.piece.sections.length; i++) {
      if (found.piece.sections[i].parentId === parent.id) { n += 1; }
    }
    var child = {
      id: w.PP.store.uid('sc'),
      label: parent.label + ' · small bit ' + n,
      notes: 'A smaller piece of "' + parent.label + '"',
      tempo: parent.tempo || null,
      archived: false,
      createdAt: Date.now(),
      auto: true,
      parentId: parent.id
    };
    found.piece.sections.splice(found.piece.sections.indexOf(parent) + n, 0, child);
    logCoach(state, sectionId, 'shrink', child.id);
    w.PP.store.save();
    return child;
  }

  function addActiveMs(state, ms) {
    var last = state.sessions.length ? state.sessions[state.sessions.length - 1] : null;
    if (!last) { return; }
    last.activeMs = (last.activeMs || 0) + ms;
    last.lastActivityAt = Date.now();
  }

  w.PP = w.PP || {};
  w.PP.engine = {
    SESSION_GAP_MS: SESSION_GAP_MS,
    MAX_GAP_MS: MAX_GAP_MS,
    ensureSession: ensureSession,
    activeRun: activeRun,
    recordPass: recordPass,
    undoLastPass: undoLastPass,
    logCoach: logCoach,
    shrinkSection: shrinkSection,
    addActiveMs: addActiveMs,
    topTag: topTag,
    currentStreak: function (state, sectionId) {
      var r = activeRun(state, sectionId);
      return r ? r.streak : 0;
    },
    clearedToday: function (state, sectionId) {
      var today = w.PP.badges.dayKey(Date.now()), i, r;
      for (i = 0; i < state.runs.length; i++) {
        r = state.runs[i];
        if (r.sectionId === sectionId && r.completedAt && w.PP.badges.dayKey(r.completedAt) === today) { return true; }
      }
      return false;
    }
  };
})(window);
