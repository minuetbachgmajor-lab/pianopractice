const { loadApp, test, assert, eq, report } = require('./harness');

function setup() {
  const win = loadApp();
  const PP = win.PP;
  const state = PP.store.get();
  const section = state.pieces[0].sections[0];
  return { PP, state, section };
}

test('three perfect passes in a row clear the section', () => {
  const { PP, state, section } = setup();
  let fx;
  for (let i = 0; i < 3; i++) {
    fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  }
  eq(fx.streak, 3, 'streak');
  assert(fx.completed, 'run should complete on the third perfect pass');
  assert(fx.sticker, 'a sticker is awarded');
  assert(fx.sticker.golden, 'a run with no mistakes earns a golden sticker');
  eq(state.runs[0].passCount, 3);
  eq(state.runs[0].failCount, 0);
});

test('one mistake resets the count to zero', () => {
  const { PP, state, section } = setup();
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  const fx = PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['fingering'] });
  eq(fx.streak, 0, 'streak resets');
  assert(!fx.completed, 'not completed');
  eq(state.runs[0].failCount, 1);
  eq(state.runs[0].tagCounts.fingering, 1);
});

test('criteria are recorded with a timestamp on every imperfect pass', () => {
  const { PP, state, section } = setup();
  const t0 = Date.now();
  PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['wrong_note', 'rushed'] });
  const p = state.passes[0];
  eq(p.tags.length, 2);
  assert(p.ts >= t0, 'timestamped');
  eq(p.ok, false);
  eq(p.attemptInRun, 1);
});

test('a perfect pass never carries criteria', () => {
  const { PP, state, section } = setup();
  PP.engine.recordPass(state, { sectionId: section.id, ok: true, tags: ['wrong_note'] });
  eq(state.passes[0].tags.length, 0);
});

test('passCount counts every try, including the failed ones', () => {
  const { PP, state, section } = setup();
  const seq = [true, false, true, true, false, true, true, true];
  let fx;
  seq.forEach((ok) => { fx = PP.engine.recordPass(state, { sectionId: section.id, ok, tags: ok ? [] : ['stopped'] }); });
  assert(fx.completed, 'completes on the final three');
  eq(state.runs[0].passCount, 8, 'eight tries to clear');
  eq(state.runs[0].failCount, 2);
  assert(!fx.sticker.golden, 'not a clean run, so not golden');
});

test('a new run opens after a section is cleared', () => {
  const { PP, state, section } = setup();
  for (let i = 0; i < 3; i++) { PP.engine.recordPass(state, { sectionId: section.id, ok: true }); }
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  eq(state.runs.length, 2, 'second run opened');
  eq(state.runs[1].streak, 1);
});

test('the coach speaks up after the configured number of resets', () => {
  const { PP, state, section } = setup();
  state.settings.coachAfter = 5;
  let coach = null;
  for (let i = 0; i < 5; i++) {
    const fx = PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['fingering'] });
    coach = fx.coach;
  }
  assert(coach, 'coach fires on the fifth reset');
  eq(coach.topTag, 'fingering', 'coach names the most common mistake');
});

test('the coach stays quiet before the threshold', () => {
  const { PP, state, section } = setup();
  state.settings.coachAfter = 5;
  for (let i = 0; i < 4; i++) {
    const fx = PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['rushed'] });
    assert(!fx.coach, 'no coach at reset ' + (i + 1));
  }
});

test('shrinking a section adds a smaller child of the same piece', () => {
  const { PP, state, section } = setup();
  const child = PP.engine.shrinkSection(state, section.id);
  assert(child, 'child created');
  eq(child.parentId, section.id);
  assert(child.auto, 'marked as coach-created');
  eq(state.pieces[0].sections.length, 4);
  eq(state.coachEvents.length, 1);
});

test('undo takes back the last pass and rebuilds the streak', () => {
  const { PP, state, section } = setup();
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['stopped'] });
  eq(state.runs[0].streak, 0);
  assert(PP.engine.undoLastPass(state), 'undo succeeds');
  eq(state.runs[0].streak, 2, 'streak restored to two');
  eq(state.runs[0].failCount, 0);
  eq(state.passes.length, 2);
});

test('undo refuses to reopen a cleared section', () => {
  const { PP, state, section } = setup();
  for (let i = 0; i < 3; i++) { PP.engine.recordPass(state, { sectionId: section.id, ok: true }); }
  assert(!PP.engine.undoLastPass(state), 'a finished run is not undoable');
  eq(state.passes.length, 3);
});

test('a custom streak goal is honoured and frozen into the run', () => {
  const { PP, state, section } = setup();
  state.settings.streakGoal = 5;
  let fx;
  for (let i = 0; i < 4; i++) { fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true }); }
  assert(!fx.completed, 'four is not yet five');
  fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  assert(fx.completed, 'five clears it');
});

test('badges are earned and never doubled', () => {
  const { PP, state, section } = setup();
  const fx1 = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  assert(fx1.newBadges.indexOf('first_star') >= 0, 'first star earned');
  const fx2 = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  assert(fx2.newBadges.indexOf('first_star') < 0, 'not earned twice');
  const keys = state.badges.map((b) => b.key);
  eq(keys.filter((k) => k === 'first_star').length, 1);
});

test('passes far apart start a new session', () => {
  const { PP, state, section } = setup();
  const t = Date.now();
  PP.engine.recordPass(state, { sectionId: section.id, ok: true, now: t });
  PP.engine.recordPass(state, { sectionId: section.id, ok: true, now: t + PP.engine.SESSION_GAP_MS + 1000 });
  eq(state.sessions.length, 2, 'a 45-minute gap means a new session');
});

test('the gap between passes is capped so breaks are not counted as practice', () => {
  const { PP, state, section } = setup();
  const t = Date.now();
  PP.engine.recordPass(state, { sectionId: section.id, ok: true, now: t });
  PP.engine.recordPass(state, { sectionId: section.id, ok: true, now: t + 20 * 60 * 1000 });
  eq(state.passes[1].gapMs, PP.engine.MAX_GAP_MS);
});

test('state survives a save/load round trip', () => {
  const { PP, state, section } = setup();
  PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['dynamics'] });
  const copy = PP.store.normalize(JSON.parse(JSON.stringify(state)));
  eq(copy.passes.length, 1);
  eq(copy.passes[0].tags[0], 'dynamics');
});

test('normalize repairs a damaged save file instead of wiping it', () => {
  const { PP } = setup();
  const broken = { v: 1, pieces: [{ id: 'p1', name: 'X' }], passes: null };
  const fixed = PP.store.normalize(broken);
  assert(Array.isArray(fixed.passes), 'passes restored');
  assert(Array.isArray(fixed.pieces[0].sections), 'sections restored');
  assert(fixed.settings.streakGoal, 'settings restored');
});

test('report rows carry the fields the charts read', () => {
  const { PP, state, section } = setup();
  [true, false, true, true, false, true, true, true].forEach((ok) => {
    PP.engine.recordPass(state, { sectionId: section.id, ok, tags: ok ? [] : ['fingering'] });
  });
  const mix = PP.stats.criteriaMix(state, 0);
  assert(mix.rows.length > 0, 'criteria were counted');
  eq(typeof mix.rows[0].count, 'number');
  eq(mix.rows[0].id, 'fingering');

  const diff = PP.stats.sectionDifficulty(state, 0);
  eq(diff.length, 1);
  eq(typeof diff[0].avgTries, 'number');
  eq(diff[0].topTag, 'fingering');

  const cards = PP.stats.scoreCards(state, 5);
  eq(cards.length, 1);
  assert(cards[0].sticker, 'score card carries its sticker');
});

test('the passes CSV keeps one row per pass with its criteria', () => {
  const { PP, state, section } = setup();
  PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['wrong_note', 'rushed'], note: 'bar 12' });
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  const lines = PP.stats.passesCsv(state).split('\n');
  eq(lines.length, 3, 'header plus two passes');
  assert(lines[0].indexOf('criteria_labels') >= 0, 'labels column');
  assert(lines[1].indexOf('Wrong note|Rushed') >= 0, 'labels written out: ' + lines[1]);
  assert(lines[1].indexOf('bar 12') >= 0, 'note kept');
  assert(lines[2].indexOf('perfect') >= 0, 'result recorded');
});

test('a field containing a comma is quoted in the CSV', () => {
  const { PP, state } = setup();
  state.pieces[0].name = 'Minuet in G, BWV Anh. 114';
  PP.engine.recordPass(state, { sectionId: state.pieces[0].sections[0].id, ok: true });
  const line = PP.stats.passesCsv(state).split('\n')[1];
  assert(line.indexOf('"Minuet in G, BWV Anh. 114"') >= 0, 'quoted: ' + line);
});

report();
