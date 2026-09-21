# Piano Practice 🎹

A practice book for one eight-year-old pianist, built around one rule:

> **Three perfect passes in a row clears the bit. One mistake and the count goes back to zero.**

The twist is who decides. After every pass *she* judges it — perfect, or
something slipped — and if something slipped, she taps what she heard: wrong
note, wrong finger, rushed, harsh, stopped. Nothing here scolds her, and no
grown-up overrules her. Naming the mistake is the skill being trained; the
streak is just the scoreboard.

Every pass is stored with its timestamp and its tags, so the parent area can
answer the questions that actually change a lesson: *which mistake keeps coming
back, which bars are expensive, is it getting faster?*

## On the iPad

Built for an **iPad mini 3 (iPadOS 12.5, Safari 12)** and kept there on
purpose: no build step, no framework, no bundler, no network. Serve the folder
over HTTPS, open it in Safari, then **Share → Add to Home Screen**. It runs
full-screen and offline from then on.

GitHub Pages works well for this — point it at the repo and open
`https://<user>.github.io/pianopractice/`. A local static server
(`npm start`, then the laptop's LAN address) works too.

Everything is stored in that iPad's local storage. Nothing is uploaded, there
is no account, and no data leaves the device — which also means **a cleared
Safari cache takes the history with it**, so take a backup from
`Grown-ups → Data` every few weeks.

## How it works

**Her side**

- **Pieces** — each piece holds named bits ("bars 9–16, hands together"). She
  picks one and plays it.
- **Perfect / Oops** — two big buttons. Perfect lights a star; Oops opens the
  criteria chips and sends the stars back to zero.
- **Today's score card** — every pass, with the time and the tags, right on
  screen so the session is visible as it happens.
- **Undo last** — for the fat-finger tap. It refuses to undo a cleared streak.
- **The coach** — after five resets on the same bit a card appears offering a
  slower tempo, a smaller bit, or a break. It never ends the work for her, and
  which one she picks is logged.
- **Collection** — a sticker per cleared streak (gold for a streak with no
  mistakes at all), sixteen badges, and every score card she has earned.

**Your side** (behind a PIN — it starts at `1234`, change it)

- **Reports** — what she catches most, tries-per-streak by week, a practice
  calendar, the hardest bits, and recent score cards. Every chart has a
  "show the numbers" table.
- **Pieces** — add pieces and bits, set a target tempo and a note for her, and
  choose which criteria each piece or each bit is working on.
- **Library** — all 49 criteria, which are in the default set, and a button to
  write your own.
- **Data** — CSV of every pass, CSV of every streak, and a full JSON backup.

## The criteria library

Forty-nine criteria across nine groups — and, crucially, **the parent assigns a
handful of them to each piece or each section**, so a pass is judged on what
that passage is actually working on. A section whose note says *"2 hands, soft
tone, rotate wrist, breathe each measure"* gets exactly those four chips and
nothing else.

| Group | Covers |
|---|---|
| 🎼 Notes & Rhythm | wrong note, wrong rhythm, note lengths, accidentals, rests, counting out loud |
| ✋ Fingers & Hands | fingering, hand shape, thumb-under, tension, hands lining up, hand independence |
| 🌊 Flow & Memory | stopping, hesitating, restarting, memory slips, losing your place |
| 🎨 Tone & Touch | harsh tone, **soft tone**, timid tone, singing melody, even touch, arm weight |
| 🎯 Articulation | **legato**, **staccato**, slur endings, accents, phrase endings |
| 💨 Breath & Phrasing | **breathing**, breath placement, phrase shape, dynamics, dynamic range |
| 🤸 Gesture & Body | **wrist rotation**, follow-through, lifting, posture, shoulders, eyes, bench |
| ⏱️ Tempo | rushing, dragging, pulse, starting tempo, holding the practice speed |
| ⚖️ Balance & Pedal | melody balance, voicing, pedal clarity, pedal timing |

**Assignment resolves in three levels**, most specific first:

1. the section's own list, if it has one
2. otherwise the piece's list
3. otherwise the default set in `Grown-ups → Library`

An empty list always means *inherit*, never *nothing to tag* — a section with no
criteria would make the Oops button useless. Whatever is assigned, the rest of
the library stays one tap away behind **"Something else?"**, so a focused list
never stops her naming something real.

Parents can also **write their own criteria** (`Grown-ups → Library → Write my
own criterion`). Custom ones behave exactly like built-ins: assignable, taggable,
charted, and exported under their own names.

Ordering follows how practice quality is usually assessed — accuracy (notes,
rhythm, fingering) before control (tone, articulation, tempo, dynamics) before
musicianship (phrasing, balance, pedalling) — with flow tracked throughout,
because fluency is what performing actually tests. Eleven basics ship switched on
as the default set; the subtler ones wait until a teacher asks for them.

## The data

`Grown-ups → Data` exports three things. On iPadOS 12 a web app cannot download
files, so each export also shows its text with a **Copy** button — paste it into
an email to yourself.

- **`practice-passes.csv`** — one row per pass: `timestamp_iso`, `date`,
  `time_local`, session and run ids, piece, section, `perfect`/`oops`,
  `attempt_in_run`, `streak_after`, `seconds_since_previous`, `criteria_ids`,
  `criteria_labels`, `note`.
- **`practice-streaks.csv`** — one row per streak attempt: tries, mistakes,
  minutes, whether it was clean, and the full criteria breakdown.
- **`piano-practice-backup.json`** — everything, restorable from the same screen.

## Working on it

```
npm test        # engine + stats unit tests (Node, no browser)
npm run lint    # Safari 12 baseline check — bans syntax the iPad cannot parse
npm run e2e     # drives the real app in Chromium at iPad mini resolution
npm start       # static server for local testing
npm run icons   # regenerate the app icons from the inline SVG
npm run shots   # screenshots against six weeks of generated history
```

`npm run lint` is the one that matters most. Chromium will happily run syntax
an iPad mini 3 cannot parse, and a parse error there shows up as a blank white
screen, so the baseline is checked rather than hoped for: no optional chaining,
no nullish coalescing, no `clamp()`, no flexbox `gap`, no `:is()`, no `<dialog>`.

## Layout

```
index.html            app shell, scripts in load order
manifest.webmanifest  PWA manifest (iOS 12 reads the <meta> tags instead)
sw.js                 offline cache — bump CACHE when shell files change
css/app.css           all styles, light and dark
js/criteria.js        the 49-criterion library, groups and assignment rules
js/store.js           localStorage, versioned state, repair-on-load
js/engine.js          the three-in-a-row rule, runs, coach, undo
js/stats.js           report aggregations and CSV export
js/badges.js          badge rules (pure functions of state)
js/charts.js          hand-rolled bars, line and calendar
js/view-*.js          the four screens
tools/                icons, demo data, screenshots, compat lint
tests/                unit tests and the browser walkthrough
```
