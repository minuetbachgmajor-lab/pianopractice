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

test('a section with no list of its own inherits the default set', () => {
  const { PP, state, section } = setup();
  eq(PP.criteria.sourceFor(state, section.id), 'default');
  eq(PP.criteria.resolveFor(state, section.id).length, state.settings.activeCriteria.length);
});

test('a piece list overrides the default set for all its bits', () => {
  const { PP, state, section } = setup();
  state.pieces[0].criteria = ['soft_tone', 'breath'];
  eq(PP.criteria.sourceFor(state, section.id), 'piece');
  eq(PP.criteria.resolveFor(state, section.id).join(), 'soft_tone,breath');
});

test('a section list overrides its piece list', () => {
  const { PP, state, section } = setup();
  state.pieces[0].criteria = ['soft_tone', 'breath'];
  section.criteria = ['wrist_rotate'];
  eq(PP.criteria.sourceFor(state, section.id), 'section');
  eq(PP.criteria.resolveFor(state, section.id).join(), 'wrist_rotate');
  /* sibling bits are untouched by one bit's override */
  eq(PP.criteria.resolveFor(state, state.pieces[0].sections[1].id).join(), 'soft_tone,breath');
});

test('an empty list means inherit, never "no criteria at all"', () => {
  const { PP, state, section } = setup();
  section.criteria = [];
  eq(PP.criteria.sourceFor(state, section.id), 'default');
  assert(PP.criteria.resolveFor(state, section.id).length > 0, 'she can always tag something');
});

test('the library covers the points a teacher actually names', () => {
  const { PP } = setup();
  ['soft_tone', 'legato', 'staccato', 'breath', 'phrase_shape',
   'wrist_rotate', 'arm_circle', 'lift', 'rushed', 'tempo_hold'].forEach((id) => {
    assert(PP.criteria.get(id), 'library is missing ' + id);
  });
  assert(PP.criteria.library().length >= 45, 'library is substantial');
});

test('every criterion has a group that exists, and no id is duplicated', () => {
  const { PP } = setup();
  const groups = PP.criteria.GROUPS.map((g) => g.id);
  const seen = {};
  PP.criteria.library().forEach((c) => {
    assert(groups.indexOf(c.group) >= 0, c.id + ' has unknown group ' + c.group);
    assert(c.label && c.emoji, c.id + ' needs a label and an emoji');
    assert(!seen[c.id], 'duplicate id ' + c.id);
    seen[c.id] = true;
  });
});

test('a custom criterion behaves like a built-in one', () => {
  const { PP, state, section } = setup();
  state.settings.customCriteria.push({
    id: 'cc_1', custom: true, group: 'gesture',
    emoji: '🌀', label: 'Rotate the wrist', hint: 'Roll, do not poke'
  });
  eq(PP.criteria.label('cc_1'), 'Rotate the wrist');
  eq(PP.criteria.emoji('cc_1'), '🌀');

  section.criteria = ['cc_1'];
  eq(PP.criteria.resolveFor(state, section.id).join(), 'cc_1');

  PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['cc_1'] });
  const mix = PP.stats.criteriaMix(state, 0);
  eq(mix.rows[0].label, 'Rotate the wrist');
  assert(PP.stats.passesCsv(state).indexOf('Rotate the wrist') >= 0, 'custom label reaches the CSV');
});

test('clean() drops ids that no longer exist', () => {
  const { PP } = setup();
  eq(PP.criteria.clean(['wrong_note', 'gone_forever', 'rushed']).join(), 'wrong_note,rushed');
  eq(PP.criteria.clean(['rushed', 'rushed']).join(), 'rushed', 'and de-duplicates');
});

test('a shrunk section keeps what its parent was working on', () => {
  const { PP, state, section } = setup();
  section.criteria = ['soft_tone', 'wrist_rotate'];
  const child = PP.engine.shrinkSection(state, section.id);
  eq(PP.criteria.resolveFor(state, child.id).join(), 'soft_tone,wrist_rotate');
});

test('an old save file with no criteria fields still opens', () => {
  const { PP } = setup();
  const old = {
    v: 1, settings: { streakGoal: 3, activeCriteria: ['wrong_note'] },
    pieces: [{ id: 'p1', name: 'X', sections: [{ id: 's1', label: 'A' }] }],
    passes: [], runs: [], sessions: [], stickers: [], badges: [], coachEvents: []
  };
  const fixed = PP.store.normalize(old);
  eq(fixed.pieces[0].criteria, null, 'piece defaults to inherit');
  eq(fixed.pieces[0].sections[0].criteria, null, 'section defaults to inherit');
  assert(Array.isArray(fixed.settings.customCriteria), 'custom list created');
});

test('a bit with no goal of its own uses the global default', () => {
  const { PP, state, section } = setup();
  state.settings.streakGoal = 4;
  eq(PP.engine.goalFor(state, section.id), 4);
  eq(PP.engine.goalSource(state, section.id), 'default');
});

test('a piece goal overrides the default for all its bits', () => {
  const { PP, state, section } = setup();
  state.settings.streakGoal = 3;
  state.pieces[0].streakGoal = 5;
  eq(PP.engine.goalFor(state, section.id), 5);
  eq(PP.engine.goalSource(state, section.id), 'piece');
});

test('a bit goal overrides its piece goal', () => {
  const { PP, state, section } = setup();
  state.pieces[0].streakGoal = 5;
  section.streakGoal = 3;
  eq(PP.engine.goalFor(state, section.id), 3);
  eq(PP.engine.goalSource(state, section.id), 'section');
  /* the sibling bit still runs the piece goal */
  eq(PP.engine.goalFor(state, state.pieces[0].sections[1].id), 5);
});

test('a five-in-a-row bit needs all five', () => {
  const { PP, state, section } = setup();
  section.streakGoal = 5;
  let fx;
  for (let i = 0; i < 4; i++) { fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true }); }
  assert(!fx.completed, 'four is not enough');
  eq(fx.goal, 5, 'the run reports its own goal');
  fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  assert(fx.completed, 'five clears it');
  eq(state.runs[0].goal, 5);
});

test('changing the goal mid-streak does not move the finish line', () => {
  const { PP, state, section } = setup();
  section.streakGoal = 3;
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  section.streakGoal = 5;               /* parent edits it mid-run */
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  const fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  assert(fx.completed, 'the run she started keeps the goal it began with');
  eq(state.runs[0].goal, 3);
  /* the next run picks up the new goal */
  const next = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  eq(next.goal, 5);
});

test('a goal change between streaks takes effect at once', () => {
  const { PP, state, section } = setup();
  section.streakGoal = 3;
  PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  PP.engine.recordPass(state, { sectionId: section.id, ok: false, tags: ['rushed'] });
  eq(state.runs[0].streak, 0, 'back to zero');
  section.streakGoal = 5;               /* parent raises it while she is at zero */
  const fx = PP.engine.recordPass(state, { sectionId: section.id, ok: true });
  eq(fx.goal, 5, 'nothing was in flight, so the new goal applies now');
});

test('a shrunk bit keeps its parent goal', () => {
  const { PP, state, section } = setup();
  section.streakGoal = 5;
  const child = PP.engine.shrinkSection(state, section.id);
  eq(PP.engine.goalFor(state, child.id), 5);
});

test('an old save file with no goal fields still opens', () => {
  const { PP } = setup();
  const fixed = PP.store.normalize({
    v: 1, settings: { streakGoal: 3, activeCriteria: ['wrong_note'] },
    pieces: [{ id: 'p1', name: 'X', sections: [{ id: 's1', label: 'A' }] }],
    passes: [], runs: [], sessions: [], stickers: [], badges: [], coachEvents: []
  });
  eq(fixed.pieces[0].streakGoal, null);
  eq(fixed.pieces[0].sections[0].streakGoal, null);
  eq(PP.engine.goalFor(fixed, 's1'), 3, 'falls back to the global setting');
});

report();
