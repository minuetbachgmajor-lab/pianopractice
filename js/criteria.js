/* The criteria library.
 *
 * Every point a pass can be judged on, grouped the way a teacher listens.
 * This is a LIBRARY, not a fixed checklist: a parent assigns a handful of
 * these to a piece or to a single section, and only those appear on the
 * practice screen. A section with "soft tone, rotate wrist, breathe each
 * measure" written on it gets exactly those chips.
 *
 * Resolution order for any section: the section's own list, else the
 * piece's list, else the default set in settings. Parents can also add
 * their own criteria, which live in settings.customCriteria and behave
 * identically to the built-in ones everywhere. */
(function (w) {
  'use strict';

  var GROUPS = [
    { id: 'notes',   label: 'Notes & Rhythm',    emoji: '🎼' },
    { id: 'fingers', label: 'Fingers & Hands',   emoji: '✋' },
    { id: 'flow',    label: 'Flow & Memory',     emoji: '🌊' },
    { id: 'tone',    label: 'Tone & Touch',      emoji: '🎨' },
    { id: 'artic',   label: 'Articulation',      emoji: '🎯' },
    { id: 'breath',  label: 'Breath & Phrasing', emoji: '💨' },
    { id: 'gesture', label: 'Gesture & Body',    emoji: '🤸' },
    { id: 'tempo',   label: 'Tempo',             emoji: '⏱️' },
    { id: 'balance', label: 'Balance & Pedal',   emoji: '⚖️' }
  ];

  /* `on: true` puts a criterion in the starting default set — the list a
   * section falls back to when nothing more specific is assigned. */
  var CRITERIA = [
    /* --- notes & rhythm --- */
    { id: 'wrong_note',   group: 'notes', emoji: '🎵', label: 'Wrong note',           hint: 'A note that was not on the page', on: true },
    { id: 'rhythm',       group: 'notes', emoji: '🥁', label: 'Wrong rhythm',         hint: 'The counting went off', on: true },
    { id: 'note_length',  group: 'notes', emoji: '🕰️', label: 'Held it wrong',        hint: 'Too short or too long' },
    { id: 'accidental',   group: 'notes', emoji: '🎹', label: 'Missed a sharp or flat', hint: 'Check the key signature' },
    { id: 'rest',         group: 'notes', emoji: '🤫', label: 'Missed a rest',        hint: 'Silence is written too' },
    { id: 'counting',     group: 'notes', emoji: '🗣️', label: 'Forgot to count',      hint: 'Count out loud' },

    /* --- fingers & hands --- */
    { id: 'fingering',    group: 'fingers', emoji: '✋', label: 'Wrong finger',        hint: 'Not the finger number written', on: true },
    { id: 'hand_shape',   group: 'fingers', emoji: '🐾', label: 'Flat fingers',        hint: 'Round hands, soft knuckles', on: true },
    { id: 'thumb',        group: 'fingers', emoji: '👍', label: 'Bumpy thumb',         hint: 'Slide the thumb under smoothly' },
    { id: 'tense_hands',  group: 'fingers', emoji: '🧊', label: 'Tight hands',         hint: 'Loose wrist, no squeezing' },
    { id: 'hands_together', group: 'fingers', emoji: '🤝', label: 'Hands did not line up', hint: 'Both hands land together' },
    { id: 'independence', group: 'fingers', emoji: '🪢', label: 'Hands copied each other', hint: 'Each hand has its own job' },

    /* --- flow & memory --- */
    { id: 'stopped',      group: 'flow', emoji: '🛑', label: 'I stopped',             hint: 'The music stopped moving', on: true },
    { id: 'hesitated',    group: 'flow', emoji: '😬', label: 'Hesitated',             hint: 'A little wobble or pause', on: true },
    { id: 'restarted',    group: 'flow', emoji: '🔁', label: 'Started over',          hint: 'Went back to the beginning', on: true },
    { id: 'memory_slip',  group: 'flow', emoji: '💭', label: 'Memory slip',           hint: 'Forgot what came next' },
    { id: 'lost_place',   group: 'flow', emoji: '🔍', label: 'Lost my place',         hint: 'Eyes fell off the music' },

    /* --- tone & touch --- */
    { id: 'tone_harsh',   group: 'tone', emoji: '💥', label: 'Harsh or bangy',        hint: 'The piano sounded cross', on: true },
    { id: 'soft_tone',    group: 'tone', emoji: '☁️', label: 'Not a soft tone',       hint: 'Warm and round, never sharp' },
    { id: 'tone_weak',    group: 'tone', emoji: '🪶', label: 'Too timid',             hint: 'So quiet it disappeared' },
    { id: 'singing',      group: 'tone', emoji: '🕊️', label: 'Did not sing',          hint: 'The melody needs a voice' },
    { id: 'uneven_touch', group: 'tone', emoji: '🪵', label: 'Bumpy touch',           hint: 'Every note the same weight' },
    { id: 'arm_weight',   group: 'tone', emoji: '🫳', label: 'No arm weight',         hint: 'Let the arm do the work, not the fingers' },

    /* --- articulation --- */
    { id: 'legato',       group: 'artic', emoji: '🔗', label: 'Legato was not smooth', hint: 'Join the notes, no gaps', on: true },
    { id: 'staccato',     group: 'artic', emoji: '⚡', label: 'Staccato was not short', hint: 'Bouncy and light' },
    { id: 'slur_end',     group: 'artic', emoji: '🪂', label: 'Slur ending not lifted', hint: 'Lift gently where the slur stops' },
    { id: 'accent',       group: 'artic', emoji: '💢', label: 'Missed an accent',      hint: 'Give that note a little push' },
    { id: 'phrase_end',   group: 'artic', emoji: '🍃', label: 'Phrase ending too heavy', hint: 'Taper it away' },

    /* --- breath & phrasing --- */
    { id: 'breath',       group: 'breath', emoji: '💨', label: 'Forgot to breathe',   hint: 'Breathe where the phrase breathes' },
    { id: 'breath_place', group: 'breath', emoji: '📍', label: 'Breathed in the wrong place', hint: 'Between phrases, not inside one' },
    { id: 'phrase_shape', group: 'breath', emoji: '🌈', label: 'No shape',            hint: 'Every phrase rises and falls' },
    { id: 'dynamics',     group: 'breath', emoji: '🔊', label: 'Forgot loud and soft', hint: 'The f and p signs', on: true },
    { id: 'dynamic_range',group: 'breath', emoji: '📶', label: 'Loud and soft too alike', hint: 'Make the difference bigger' },

    /* --- gesture & body --- */
    { id: 'wrist_rotate', group: 'gesture', emoji: '🔄', label: 'No wrist rotation',  hint: 'Roll the wrist, do not poke' },
    { id: 'arm_circle',   group: 'gesture', emoji: '🎡', label: 'No follow-through',  hint: 'Let the arm draw a circle' },
    { id: 'lift',         group: 'gesture', emoji: '🕊', label: 'Forgot to lift',     hint: 'Lift the hand at the end' },
    { id: 'posture',      group: 'gesture', emoji: '🪑', label: 'Slouchy sitting',    hint: 'Tall back, feet steady' },
    { id: 'shoulders',    group: 'gesture', emoji: '🧘', label: 'Tight shoulders',    hint: 'Drop the shoulders' },
    { id: 'eyes',         group: 'gesture', emoji: '👀', label: 'Looked at my hands', hint: 'Eyes stay on the music' },
    { id: 'bench',        group: 'gesture', emoji: '📏', label: 'Bench too close or far', hint: 'Elbows level with the keys' },

    /* --- tempo --- */
    { id: 'rushed',       group: 'tempo', emoji: '🐇', label: 'Rushed',               hint: 'Sped up in the easy bits', on: true },
    { id: 'dragged',      group: 'tempo', emoji: '🐢', label: 'Dragged',              hint: 'Slowed down in the hard bits' },
    { id: 'uneven',       group: 'tempo', emoji: '〰️', label: 'Bumpy pulse',          hint: 'The beat wobbled' },
    { id: 'start_tempo',  group: 'tempo', emoji: '🚦', label: 'Started too fast',     hint: 'Pick the speed of the hardest bar' },
    { id: 'tempo_hold',   group: 'tempo', emoji: '🎚️', label: 'Left the practice speed', hint: 'Stay at the speed we set' },

    /* --- balance & pedal --- */
    { id: 'balance',      group: 'balance', emoji: '⚖️', label: 'Tune got buried',    hint: 'Melody louder than the rest' },
    { id: 'voicing',      group: 'balance', emoji: '🎭', label: 'Inside notes too loud', hint: 'Keep the accompaniment soft' },
    { id: 'pedal',        group: 'balance', emoji: '🦶', label: 'Pedal was muddy',    hint: 'Change the pedal cleanly' },
    { id: 'pedal_time',   group: 'balance', emoji: '⏲️', label: 'Pedal late or early', hint: 'Change it just after the beat' }
  ];

  var builtIn = {};
  for (var i = 0; i < CRITERIA.length; i++) { builtIn[CRITERIA[i].id] = CRITERIA[i]; }

  /* Custom criteria live in saved state. Reading them lazily keeps every
   * call site — labels in reports, chips, CSV export — working with both
   * kinds without threading state through the whole app. */
  function customList() {
    try {
      var s = w.PP.store.get();
      return s.settings.customCriteria || [];
    } catch (e) { return []; }
  }

  function get(id) {
    if (builtIn[id]) { return builtIn[id]; }
    var custom = customList(), i;
    for (i = 0; i < custom.length; i++) { if (custom[i].id === id) { return custom[i]; } }
    return null;
  }

  /* The whole library: built-in first, then anything the parent added. */
  function library() {
    return CRITERIA.concat(customList());
  }

  function inGroup(groupId) {
    var all = library(), out = [], i;
    for (i = 0; i < all.length; i++) { if (all[i].group === groupId) { out.push(all[i]); } }
    return out;
  }

  function defaultActive() {
    var out = [], i;
    for (i = 0; i < CRITERIA.length; i++) { if (CRITERIA[i].on) { out.push(CRITERIA[i].id); } }
    return out;
  }

  function isAssigned(list) { return !!(list && list.length); }

  /* Section list wins, then the piece's, then the global default set.
   * An empty or missing list means "inherit", never "no criteria at all" —
   * a section with nothing to tag would make the Oops button useless. */
  function resolveFor(state, sectionId) {
    var found = w.PP.store.findSection(state, sectionId);
    if (found) {
      if (isAssigned(found.section.criteria)) { return found.section.criteria.slice(); }
      if (isAssigned(found.piece.criteria)) { return found.piece.criteria.slice(); }
    }
    return (state.settings.activeCriteria || defaultActive()).slice();
  }

  /* Where a section's list actually came from, for the parent UI to show. */
  function sourceFor(state, sectionId) {
    var found = w.PP.store.findSection(state, sectionId);
    if (found && isAssigned(found.section.criteria)) { return 'section'; }
    if (found && isAssigned(found.piece.criteria)) { return 'piece'; }
    return 'default';
  }

  /* Drops ids that no longer exist, so a deleted custom criterion cannot
   * leave a blank chip behind. */
  function clean(ids) {
    var out = [], i;
    for (i = 0; i < (ids || []).length; i++) {
      if (get(ids[i]) && out.indexOf(ids[i]) < 0) { out.push(ids[i]); }
    }
    return out;
  }

  w.PP = w.PP || {};
  w.PP.criteria = {
    GROUPS: GROUPS,
    ALL: CRITERIA,
    library: library,
    inGroup: inGroup,
    get: get,
    clean: clean,
    defaultActive: defaultActive,
    resolveFor: resolveFor,
    sourceFor: sourceFor,
    isAssigned: isAssigned,
    label: function (id) { var c = get(id); return c ? c.label : id; },
    emoji: function (id) { var c = get(id); return c ? c.emoji : '•'; },
    hint:  function (id) { var c = get(id); return c ? c.hint : ''; },
    groupOf: function (id) { var c = get(id); return c ? c.group : 'notes'; },
    groupLabel: function (groupId) {
      var i;
      for (i = 0; i < GROUPS.length; i++) { if (GROUPS[i].id === groupId) { return GROUPS[i].label; } }
      return groupId;
    }
  };
})(window);
