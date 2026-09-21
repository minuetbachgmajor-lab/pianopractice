/* Sticker art. One sticker per completed streak; the art is picked
 * deterministically from the run id so a sticker never changes after it
 * has been earned. */
(function (w) {
  'use strict';

  var ART = [
    { emoji: '🐱', tint: 'peach' }, { emoji: '🦄', tint: 'lilac' },
    { emoji: '🧁', tint: 'rose'  }, { emoji: '🌈', tint: 'sky'   },
    { emoji: '🐧', tint: 'mint'  }, { emoji: '🚀', tint: 'sky'   },
    { emoji: '🍓', tint: 'rose'  }, { emoji: '🐢', tint: 'mint'  },
    { emoji: '🌻', tint: 'lemon' }, { emoji: '🐳', tint: 'sky'   },
    { emoji: '🍩', tint: 'peach' }, { emoji: '🦋', tint: 'lilac' },
    { emoji: '🐨', tint: 'mint'  }, { emoji: '⭐', tint: 'lemon' },
    { emoji: '🎈', tint: 'rose'  }, { emoji: '🐰', tint: 'peach' }
  ];

  function hash(str) {
    var h = 5381, i;
    for (i = 0; i < str.length; i++) { h = ((h << 5) + h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  w.PP = w.PP || {};
  w.PP.stickers = {
    ART: ART,
    /* clean === cleared the streak with no mistakes at all -> golden sticker */
    pick: function (seed, clean) {
      var a = ART[hash(String(seed)) % ART.length];
      return { emoji: a.emoji, tint: clean ? 'gold' : a.tint, golden: !!clean };
    }
  };
})(window);
