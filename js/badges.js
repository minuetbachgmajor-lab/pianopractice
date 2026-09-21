/* Badges. Every rule is a pure function of the saved state, so badges can be
 * recomputed from scratch after an import and never drift. */
(function (w) {
  'use strict';

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function practiceDays(state) {
    var seen = {}, out = [], i, k;
    for (i = 0; i < state.passes.length; i++) {
      k = dayKey(state.passes[i].ts);
      if (!seen[k]) { seen[k] = true; out.push(k); }
    }
    out.sort();
    return out;
  }

  /* Longest run of consecutive calendar days that have at least one pass. */
  function bestDayStreak(state) {
    var days = practiceDays(state), best = 0, cur = 0, prev = null, i, d;
    for (i = 0; i < days.length; i++) {
      d = new Date(days[i] + 'T00:00:00');
      if (prev && Math.round((d - prev) / 86400000) === 1) { cur += 1; } else { cur = 1; }
      if (cur > best) { best = cur; }
      prev = d;
    }
    return best;
  }

  function totalMinutes(state) {
    var ms = 0, i;
    for (i = 0; i < state.sessions.length; i++) { ms += state.sessions[i].activeMs || 0; }
    return Math.round(ms / 60000);
  }

  function completedRuns(state) {
    var out = [], i;
    for (i = 0; i < state.runs.length; i++) { if (state.runs[i].completedAt) { out.push(state.runs[i]); } }
    return out;
  }

  var BADGES = [
    { key: 'first_star', emoji: '⭐', name: 'First Star',
      blurb: 'Played one perfect pass.',
      test: function (s) { var i; for (i = 0; i < s.passes.length; i++) { if (s.passes[i].ok) { return true; } } return false; } },

    { key: 'first_run', emoji: '🥇', name: 'Three In A Row',
      blurb: 'Finished your very first streak.',
      test: function (s) { return completedRuns(s).length >= 1; } },

    { key: 'runs_10', emoji: '🏅', name: 'Ten Streaks',
      blurb: 'Ten sections cleared.',
      test: function (s) { return completedRuns(s).length >= 10; } },

    { key: 'runs_25', emoji: '🏆', name: 'Twenty-Five Streaks',
      blurb: 'Twenty-five sections cleared.',
      test: function (s) { return completedRuns(s).length >= 25; } },

    { key: 'runs_50', emoji: '👑', name: 'Fifty Streaks',
      blurb: 'Fifty sections cleared. Wow.',
      test: function (s) { return completedRuns(s).length >= 50; } },

    { key: 'flawless', emoji: '💎', name: 'Flawless',
      blurb: 'Cleared a streak with zero mistakes.',
      test: function (s) {
        var r = completedRuns(s), i;
        for (i = 0; i < r.length; i++) { if (r[i].failCount === 0) { return true; } }
        return false;
      } },

    { key: 'honest_10', emoji: '🔎', name: 'Truth Teller',
      blurb: 'Owned up to 10 imperfect passes. Spotting it is the hard part.',
      test: function (s) {
        var n = 0, i;
        for (i = 0; i < s.passes.length; i++) { if (!s.passes[i].ok) { n += 1; } }
        return n >= 10;
      } },

    { key: 'persist', emoji: '💪', name: 'Never Give Up',
      blurb: 'Cleared a streak that took 10 or more tries.',
      test: function (s) {
        var r = completedRuns(s), i;
        for (i = 0; i < r.length; i++) { if (r[i].passCount >= 10) { return true; } }
        return false;
      } },

    { key: 'slow_coach', emoji: '🐢', name: 'Slow Is Smooth',
      blurb: 'Took the slow-down tip, then cleared the streak.',
      test: function (s) {
        var i, j, ev, r;
        for (i = 0; i < s.coachEvents.length; i++) {
          ev = s.coachEvents[i];
          if (ev.kind !== 'slow') { continue; }
          for (j = 0; j < s.runs.length; j++) {
            r = s.runs[j];
            if (r.sectionId === ev.sectionId && r.completedAt && r.completedAt > ev.ts) { return true; }
          }
        }
        return false;
      } },

    { key: 'day_3', emoji: '🔥', name: 'Three Days Running',
      blurb: 'Practised three days in a row.',
      test: function (s) { return bestDayStreak(s) >= 3; } },

    { key: 'day_7', emoji: '🌟', name: 'A Whole Week',
      blurb: 'Practised seven days in a row.',
      test: function (s) { return bestDayStreak(s) >= 7; } },

    { key: 'day_30', emoji: '🎆', name: 'Thirty Days',
      blurb: 'A month of practice, every single day.',
      test: function (s) { return bestDayStreak(s) >= 30; } },

    { key: 'mins_60', emoji: '⏳', name: 'One Hour',
      blurb: 'An hour of practice all together.',
      test: function (s) { return totalMinutes(s) >= 60; } },

    { key: 'mins_600', emoji: '🕰️', name: 'Ten Hours',
      blurb: 'Ten hours at the piano.',
      test: function (s) { return totalMinutes(s) >= 600; } },

    { key: 'sections_5', emoji: '🧩', name: 'Five Bits Fixed',
      blurb: 'Cleared five different sections.',
      test: function (s) {
        var r = completedRuns(s), seen = {}, n = 0, i;
        for (i = 0; i < r.length; i++) {
          if (!seen[r[i].sectionId]) { seen[r[i].sectionId] = true; n += 1; }
        }
        return n >= 5;
      } },

    { key: 'whole_piece', emoji: '🎹', name: 'Whole Piece',
      blurb: 'Cleared every section of one piece in a single day.',
      test: function (s) {
        var byDayPiece = {}, i, r, key, p, j, sec, need, got, dayKeys, k;
        for (i = 0; i < s.runs.length; i++) {
          r = s.runs[i];
          if (!r.completedAt) { continue; }
          key = dayKey(r.completedAt) + '|' + r.pieceId;
          byDayPiece[key] = byDayPiece[key] || {};
          byDayPiece[key][r.sectionId] = true;
        }
        dayKeys = Object.keys(byDayPiece);
        for (k = 0; k < dayKeys.length; k++) {
          p = null;
          for (j = 0; j < s.pieces.length; j++) {
            if (s.pieces[j].id === dayKeys[k].split('|')[1]) { p = s.pieces[j]; }
          }
          if (!p) { continue; }
          need = 0; got = 0;
          for (j = 0; j < p.sections.length; j++) {
            sec = p.sections[j];
            if (sec.archived) { continue; }
            need += 1;
            if (byDayPiece[dayKeys[k]][sec.id]) { got += 1; }
          }
          if (need > 0 && got === need) { return true; }
        }
        return false;
      } }
  ];

  w.PP = w.PP || {};
  w.PP.badges = {
    ALL: BADGES,
    bestDayStreak: bestDayStreak,
    totalMinutes: totalMinutes,
    completedRuns: completedRuns,
    practiceDays: practiceDays,
    dayKey: dayKey,
    /* Returns the badge keys newly earned, and mutates state.badges. */
    evaluate: function (state, now) {
      var have = {}, gained = [], i, b;
      for (i = 0; i < state.badges.length; i++) { have[state.badges[i].key] = true; }
      for (i = 0; i < BADGES.length; i++) {
        b = BADGES[i];
        if (have[b.key]) { continue; }
        if (b.test(state)) {
          state.badges.push({ key: b.key, earnedAt: now || Date.now() });
          gained.push(b.key);
        }
      }
      return gained;
    },
    get: function (key) {
      var i;
      for (i = 0; i < BADGES.length; i++) { if (BADGES[i].key === key) { return BADGES[i]; } }
      return null;
    }
  };
})(window);
