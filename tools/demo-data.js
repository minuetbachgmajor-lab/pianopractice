/* Builds a plausible six weeks of practice by running the real engine, so the
 * screenshots and any dashboard tuning are done against data the app could
 * actually have produced. Not shipped to the device. */
const path = require('path');
const { loadApp } = require(path.join(__dirname, '..', 'tests', 'harness'));

const DAY = 86400000;

/* Mistakes she makes early vs. late: the note/finger basics fade, the
 * musical ones surface once the notes are secure. */
const EARLY = ['wrong_note', 'wrong_note', 'fingering', 'fingering', 'rhythm', 'stopped', 'hesitated', 'restarted'];
const LATE = ['dynamics', 'articulation', 'rushed', 'tone_harsh', 'hesitated', 'fingering'];

function rand(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function generate(weeks = 6, seed = 7) {
  const win = loadApp();
  const PP = win.PP;
  const state = PP.store.get();
  const piece = state.pieces[0];
  const r = rand(seed);

  piece.sections.forEach((s) => { s.tempo = s.tempo || 72; });
  state.child.name = 'Ada';

  const start = Date.now() - weeks * 7 * DAY;
  for (let day = 0; day < weeks * 7; day++) {
    if (r() < 0.32) { continue; }                       /* not every day */
    const dayStart = start + day * DAY + 16 * 3600000;  /* after school */
    let t = dayStart + Math.floor(r() * 30 * 60000);
    const progress = day / (weeks * 7);
    const sessionStartIdx = state.sessions.length;

    const bits = piece.sections.slice(0, 2 + (r() < 0.5 ? 1 : 0));
    bits.forEach((section) => {
      /* she gets quicker: ~9 tries early, ~4 by the end */
      const target = Math.max(3, Math.round(9 - 5 * progress + (r() * 3 - 1.5)));
      let streak = 0, tries = 0;
      while (tries < 40) {
        tries += 1;
        const clean = tries >= target - 2 ? r() < 0.75 : r() < 0.42;
        if (clean) {
          PP.engine.recordPass(state, { sectionId: section.id, ok: true, now: t });
          streak += 1;
        } else {
          const pool = r() < 1 - progress ? EARLY : LATE;
          const tags = [pool[Math.floor(r() * pool.length)]];
          if (r() < 0.3) { tags.push(pool[Math.floor(r() * pool.length)]); }
          PP.engine.recordPass(state, {
            sectionId: section.id, ok: false,
            tags: tags.filter((v, i, a) => a.indexOf(v) === i), now: t
          });
          streak = 0;
        }
        t += 25000 + Math.floor(r() * 50000);
        if (streak >= state.settings.streakGoal) { break; }
      }
    });

    /* the clock only ticks while the practice screen is open */
    for (let i = sessionStartIdx; i < state.sessions.length; i++) {
      const s = state.sessions[i];
      s.activeMs = Math.max(0, (s.lastActivityAt - s.startedAt) * 0.8);
    }
  }

  PP.badges.evaluate(state, Date.now());
  PP.store.save();
  return state;
}

module.exports = { generate };

if (require.main === module) {
  const s = generate();
  console.log(JSON.stringify({
    passes: s.passes.length, runs: s.runs.length,
    sessions: s.sessions.length, stickers: s.stickers.length, badges: s.badges.length
  }));
}
