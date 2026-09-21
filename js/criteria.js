/* Practice-quality criteria.
 *
 * Grouped the way a teacher listens: did the right notes come out, did the
 * hands behave, did it flow, did it sound like music, was the pulse steady.
 * Labels are written for an 8-year-old to judge herself with.
 */
(function (w) {
  'use strict';

  var GROUPS = [
    { id: 'notes',  label: 'Notes & Rhythm', emoji: '🎼', tint: 'lilac' },
    { id: 'hands',  label: 'Hands & Body',   emoji: '🤲', tint: 'mint'  },
    { id: 'flow',   label: 'Flow',           emoji: '🌊', tint: 'sky'   },
    { id: 'sound',  label: 'Sound & Style',  emoji: '🎨', tint: 'peach' },
    { id: 'tempo',  label: 'Tempo',          emoji: '⏱️', tint: 'rose'  }
  ];

  /* on: whether the chip is shown by default. Parents toggle the rest on
   * in the parent zone once the basics are automatic. */
  var CRITERIA = [
    { id: 'wrong_note',  group: 'notes', emoji: '🎵', label: 'Wrong note',        hint: 'A note that was not on the page', on: true },
    { id: 'rhythm',      group: 'notes', emoji: '🥁', label: 'Wrong rhythm',      hint: 'The counting went off',            on: true },
    { id: 'note_length', group: 'notes', emoji: '🕰️', label: 'Held it wrong',     hint: 'Too short or too long',            on: false },

    { id: 'fingering',   group: 'hands', emoji: '✋', label: 'Wrong finger',      hint: 'Not the finger number written',    on: true },
    { id: 'hand_shape',  group: 'hands', emoji: '🐾', label: 'Flat fingers',      hint: 'Round hands, soft wrist',          on: true },
    { id: 'posture',     group: 'hands', emoji: '🪑', label: 'Slouchy sitting',   hint: 'Tall back, feet steady',           on: false },
    { id: 'eyes',        group: 'hands', emoji: '👀', label: 'Looked at my hands',hint: 'Eyes stay on the music',           on: false },

    { id: 'stopped',     group: 'flow',  emoji: '🛑', label: 'I stopped',         hint: 'The music stopped moving',         on: true },
    { id: 'hesitated',   group: 'flow',  emoji: '😬', label: 'Hesitated',         hint: 'A little wobble or pause',         on: true },
    { id: 'restarted',   group: 'flow',  emoji: '🔁', label: 'Started over',      hint: 'Went back to the beginning',       on: true },
    { id: 'memory_slip', group: 'flow',  emoji: '💭', label: 'Memory slip',       hint: 'Forgot what came next',            on: false },

    { id: 'dynamics',    group: 'sound', emoji: '🔊', label: 'Forgot loud/soft',  hint: 'The f and p signs',                on: true },
    { id: 'articulation',group: 'sound', emoji: '🎯', label: 'Slurs & staccato',  hint: 'Smooth or bouncy, as written',     on: true },
    { id: 'tone_harsh',  group: 'sound', emoji: '💥', label: 'Harsh or bangy',    hint: 'The piano sounded cross',          on: true },
    { id: 'tone_weak',   group: 'sound', emoji: '🪶', label: 'Too timid',         hint: 'So quiet it disappeared',          on: false },
    { id: 'balance',     group: 'sound', emoji: '⚖️', label: 'Tune got buried',   hint: 'Melody louder than the rest',      on: false },
    { id: 'phrasing',    group: 'sound', emoji: '🌈', label: 'No shape',          hint: 'It sang like a robot',             on: false },
    { id: 'pedal',       group: 'sound', emoji: '🦶', label: 'Pedal was muddy',   hint: 'Change the pedal cleanly',         on: false },

    { id: 'rushed',      group: 'tempo', emoji: '🐇', label: 'Rushed',            hint: 'Sped up in the easy bits',         on: true },
    { id: 'dragged',     group: 'tempo', emoji: '🐢', label: 'Dragged',           hint: 'Slowed down in the hard bits',     on: false },
    { id: 'uneven',      group: 'tempo', emoji: '〰️', label: 'Bumpy pulse',       hint: 'The beat wobbled',                 on: false }
  ];

  var byId = {};
  for (var i = 0; i < CRITERIA.length; i++) { byId[CRITERIA[i].id] = CRITERIA[i]; }

  w.PP = w.PP || {};
  w.PP.criteria = {
    GROUPS: GROUPS,
    ALL: CRITERIA,
    get: function (id) { return byId[id] || null; },
    label: function (id) { return byId[id] ? byId[id].label : id; },
    emoji: function (id) { return byId[id] ? byId[id].emoji : '•'; },
    groupOf: function (id) { return byId[id] ? byId[id].group : 'notes'; },
    defaultActive: function () {
      var out = [];
      for (var i = 0; i < CRITERIA.length; i++) { if (CRITERIA[i].on) { out.push(CRITERIA[i].id); } }
      return out;
    }
  };
})(window);
