/* Report aggregations. Pure functions over state so they can be unit-tested
 * and re-run over any date range. */
(function (w) {
  'use strict';

  var DAY = 86400000;

  function dayKey(ts) { return w.PP.badges.dayKey(ts); }

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function rangeStart(days, now) {
    if (!days) { return 0; }
    return startOfDay(now || Date.now()) - (days - 1) * DAY;
  }

  function inRange(ts, from) { return ts >= from; }

  function completedRuns(state, from) {
    var out = [], i, r;
    for (i = 0; i < state.runs.length; i++) {
      r = state.runs[i];
      if (r.completedAt && inRange(r.completedAt, from)) { out.push(r); }
    }
    return out;
  }

  function passesIn(state, from) {
    var out = [], i;
    for (i = 0; i < state.passes.length; i++) {
      if (inRange(state.passes[i].ts, from)) { out.push(state.passes[i]); }
    }
    return out;
  }

  /* Consecutive practice days counting back from today (or yesterday, so an
   * evening practice session does not look like a broken streak at breakfast). */
  function currentDayStreak(state, now) {
    var today = startOfDay(now || Date.now());
    var days = {}, i, n = 0, cursor;
    for (i = 0; i < state.passes.length; i++) { days[dayKey(state.passes[i].ts)] = true; }
    if (!days[dayKey(today)] && !days[dayKey(today - DAY)]) { return 0; }
    cursor = days[dayKey(today)] ? today : today - DAY;
    while (days[dayKey(cursor)]) { n += 1; cursor -= DAY; }
    return n;
  }

  function minutesIn(state, from) {
    var ms = 0, i, s;
    for (i = 0; i < state.sessions.length; i++) {
      s = state.sessions[i];
      if (inRange(s.startedAt, from)) { ms += s.activeMs || 0; }
    }
    return Math.round(ms / 60000);
  }

  function summary(state, from) {
    var passes = passesIn(state, from), runs = completedRuns(state, from);
    var perfect = 0, i, totalTries = 0;
    for (i = 0; i < passes.length; i++) { if (passes[i].ok) { perfect += 1; } }
    for (i = 0; i < runs.length; i++) { totalTries += runs[i].passCount; }
    return {
      passes: passes.length,
      perfect: perfect,
      perfectPct: passes.length ? Math.round((perfect / passes.length) * 100) : 0,
      runs: runs.length,
      avgTries: runs.length ? Math.round((totalTries / runs.length) * 10) / 10 : 0,
      minutes: minutesIn(state, from),
      dayStreak: currentDayStreak(state),
      stickers: state.stickers.length,
      badges: state.badges.length
    };
  }

  /* Which kind of mistake she catches most often. Single series, ranked. */
  function criteriaMix(state, from) {
    var counts = {}, passes = passesIn(state, from), i, j, t, out = [], total = 0;
    for (i = 0; i < passes.length; i++) {
      for (j = 0; j < passes[i].tags.length; j++) {
        t = passes[i].tags[j];
        counts[t] = (counts[t] || 0) + 1;
        total += 1;
      }
    }
    for (t in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, t)) {
        out.push({
          id: t,
          label: w.PP.criteria.label(t),
          emoji: w.PP.criteria.emoji(t),
          group: w.PP.criteria.groupOf(t),
          count: counts[t],
          pct: total ? Math.round((counts[t] / total) * 100) : 0
        });
      }
    }
    out.sort(function (a, b) { return b.count - a.count; });
    return { rows: out, total: total };
  }

  /* Average tries-to-clear per week. Falling = the practice is working. */
  function triesTrend(state, from) {
    var runs = completedRuns(state, from), buckets = {}, keys, out = [], i, r, k;
    for (i = 0; i < runs.length; i++) {
      r = runs[i];
      k = weekKey(r.completedAt);
      buckets[k] = buckets[k] || { key: k, tries: 0, runs: 0, start: weekStart(r.completedAt) };
      buckets[k].tries += r.passCount;
      buckets[k].runs += 1;
    }
    keys = Object.keys(buckets).sort();
    for (i = 0; i < keys.length; i++) {
      r = buckets[keys[i]];
      out.push({
        key: r.key,
        start: r.start,
        runs: r.runs,
        avg: Math.round((r.tries / r.runs) * 10) / 10
      });
    }
    return out;
  }

  function weekStart(ts) {
    var d = new Date(startOfDay(ts));
    var dow = (d.getDay() + 6) % 7; /* Monday = 0 */
    return d.getTime() - dow * DAY;
  }
  function weekKey(ts) { return dayKey(weekStart(ts)); }

  /* Calendar of practice minutes, most recent week last. */
  function heatmap(state, weeks, now) {
    var end = startOfDay(now || Date.now());
    var startDow = (new Date(end).getDay() + 6) % 7;
    var first = end - startDow * DAY - (weeks - 1) * 7 * DAY;
    var byDay = {}, i, s, k, cells = [], ts, d;
    for (i = 0; i < state.sessions.length; i++) {
      s = state.sessions[i];
      k = dayKey(s.startedAt);
      byDay[k] = byDay[k] || { minutes: 0, passes: 0, runs: 0 };
      byDay[k].minutes += Math.round((s.activeMs || 0) / 60000);
    }
    for (i = 0; i < state.passes.length; i++) {
      k = dayKey(state.passes[i].ts);
      byDay[k] = byDay[k] || { minutes: 0, passes: 0, runs: 0 };
      byDay[k].passes += 1;
    }
    for (i = 0; i < state.runs.length; i++) {
      if (!state.runs[i].completedAt) { continue; }
      k = dayKey(state.runs[i].completedAt);
      byDay[k] = byDay[k] || { minutes: 0, passes: 0, runs: 0 };
      byDay[k].runs += 1;
    }
    for (i = 0; i < weeks * 7; i++) {
      ts = first + i * DAY;
      if (ts > end) { break; }
      d = byDay[dayKey(ts)] || { minutes: 0, passes: 0, runs: 0 };
      cells.push({
        ts: ts,
        key: dayKey(ts),
        week: Math.floor(i / 7),
        dow: i % 7,
        minutes: d.minutes,
        passes: d.passes,
        runs: d.runs
      });
    }
    return cells;
  }

  /* Which bits are actually hard, ranked by how many tries they cost. */
  function sectionDifficulty(state, from) {
    var runs = completedRuns(state, from), by = {}, out = [], i, r, k, tag, entry;
    for (i = 0; i < runs.length; i++) {
      r = runs[i];
      k = r.sectionId;
      by[k] = by[k] || { sectionId: k, pieceId: r.pieceId, runs: 0, tries: 0, fails: 0, tagCounts: {}, ms: 0 };
      by[k].runs += 1;
      by[k].tries += r.passCount;
      by[k].fails += r.failCount;
      by[k].ms += r.ms || 0;
      for (tag in r.tagCounts) {
        if (Object.prototype.hasOwnProperty.call(r.tagCounts, tag)) {
          by[k].tagCounts[tag] = (by[k].tagCounts[tag] || 0) + r.tagCounts[tag];
        }
      }
    }
    for (k in by) {
      if (!Object.prototype.hasOwnProperty.call(by, k)) { continue; }
      entry = by[k];
      out.push({
        sectionId: entry.sectionId,
        label: w.PP.store.sectionLabel(state, entry.sectionId),
        piece: w.PP.store.pieceName(state, entry.pieceId),
        runs: entry.runs,
        avgTries: Math.round((entry.tries / entry.runs) * 10) / 10,
        fails: entry.fails,
        minutes: Math.round(entry.ms / 60000),
        topTag: topKey(entry.tagCounts)
      });
    }
    out.sort(function (a, b) { return b.avgTries - a.avgTries; });
    return out;
  }

  function topKey(obj) {
    var best = null, n = 0, k;
    for (k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] > n) { n = obj[k]; best = k; }
    }
    return best;
  }

  /* Score cards, newest first: one per cleared streak. */
  function scoreCards(state, limit) {
    var out = [], i, r, sticker, j;
    for (i = state.runs.length - 1; i >= 0; i--) {
      r = state.runs[i];
      if (!r.completedAt) { continue; }
      sticker = null;
      for (j = 0; j < state.stickers.length; j++) {
        if (state.stickers[j].runId === r.id) { sticker = state.stickers[j]; }
      }
      out.push({
        run: r,
        sticker: sticker,
        piece: w.PP.store.pieceName(state, r.pieceId),
        section: w.PP.store.sectionLabel(state, r.sectionId)
      });
      if (limit && out.length >= limit) { break; }
    }
    return out;
  }

  /* --- exports ------------------------------------------------------- */

  function csvCell(v) {
    var s = v === null || typeof v === 'undefined' ? '' : String(v);
    if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  function csvRow(arr) {
    var out = [], i;
    for (i = 0; i < arr.length; i++) { out.push(csvCell(arr[i])); }
    return out.join(',');
  }
  function iso(ts) { return new Date(ts).toISOString(); }
  function localTime(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function passesCsv(state) {
    var lines = [csvRow([
      'pass_id', 'timestamp_iso', 'date', 'time_local', 'session_id', 'run_id',
      'piece', 'section', 'result', 'attempt_in_run', 'streak_after',
      'seconds_since_previous', 'criteria_ids', 'criteria_labels', 'note'
    ])], i, p, labels, j;
    for (i = 0; i < state.passes.length; i++) {
      p = state.passes[i];
      labels = [];
      for (j = 0; j < p.tags.length; j++) { labels.push(w.PP.criteria.label(p.tags[j])); }
      lines.push(csvRow([
        p.id, iso(p.ts), dayKey(p.ts), localTime(p.ts), p.sessionId, p.runId,
        w.PP.store.pieceName(state, p.pieceId), w.PP.store.sectionLabel(state, p.sectionId),
        p.ok ? 'perfect' : 'oops', p.attemptInRun, p.streakAfter,
        Math.round(p.gapMs / 1000), p.tags.join('|'), labels.join('|'), p.note
      ]));
    }
    return lines.join('\n');
  }

  function runsCsv(state) {
    var lines = [csvRow([
      'run_id', 'started_iso', 'completed_iso', 'date', 'piece', 'section',
      'goal', 'tries', 'mistakes', 'minutes', 'clean', 'top_criterion', 'criteria_breakdown'
    ])], i, r, parts, k;
    for (i = 0; i < state.runs.length; i++) {
      r = state.runs[i];
      parts = [];
      for (k in r.tagCounts) {
        if (Object.prototype.hasOwnProperty.call(r.tagCounts, k)) { parts.push(k + ':' + r.tagCounts[k]); }
      }
      lines.push(csvRow([
        r.id, iso(r.startedAt), r.completedAt ? iso(r.completedAt) : '',
        r.completedAt ? dayKey(r.completedAt) : '',
        w.PP.store.pieceName(state, r.pieceId), w.PP.store.sectionLabel(state, r.sectionId),
        r.goal, r.passCount, r.failCount, Math.round((r.ms || 0) / 60000),
        r.completedAt && r.failCount === 0 ? 'yes' : 'no',
        topKey(r.tagCounts) || '', parts.join('|')
      ]));
    }
    return lines.join('\n');
  }

  w.PP = w.PP || {};
  w.PP.stats = {
    DAY: DAY,
    startOfDay: startOfDay,
    rangeStart: rangeStart,
    summary: summary,
    criteriaMix: criteriaMix,
    triesTrend: triesTrend,
    heatmap: heatmap,
    sectionDifficulty: sectionDifficulty,
    scoreCards: scoreCards,
    currentDayStreak: currentDayStreak,
    completedRuns: completedRuns,
    passesIn: passesIn,
    minutesIn: minutesIn,
    weekStart: weekStart,
    passesCsv: passesCsv,
    runsCsv: runsCsv,
    topKey: topKey
  };
})(window);
