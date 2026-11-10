// Wire Choir building blocks: ready phrases (melody in scale steps), beatbox patterns, bass patterns and starter sets to arrange songs from.
export const CATS = {
  fast: { pl: 'Szybki scat', en: 'Fast scat' },
  swing: { pl: 'Swing', en: 'Swing' },
  doowop: { pl: 'Doo-wop', en: 'Doo-wop' },
  shout: { pl: 'Okrzyki', en: 'Shouts' },
  lala: { pl: 'Melodyjki', en: 'Tunes' },
  fill: { pl: 'Przejścia', en: 'Fills' },
  long: { pl: 'Długie nuty', en: 'Long notes' },
  talk: { pl: 'Mowa', en: 'Spoken' },
};

const T = 1 / 3;
export const PHRASES = [
  { id: 'f1', cat: 'fast', name: { pl: 'Ba ba dibi', en: 'Bah bah dibby' }, pl: 'ba ba di bi di ba du bap', en: 'bah bah dibby dee bah doo bop', n: [[4, 0.25], [4, 0.25], [5, 0.25], [4, 0.25], [2, 0.25], [4, 0.25], [2, 0.5], [0, 0.5]] },
  { id: 'f2', cat: 'fast', name: { pl: 'Ski ba dap', en: 'Ski bah dat' }, pl: 'ski ba dap ba du bap', en: 'ski bah dat bah doo bop', n: [[0, 0.25], [2, 0.25], [4, 0.5], [2, 0.25], [1, 0.25], [0, 0.5]] },
  { id: 'f3', cat: 'fast', name: { pl: 'Szabada', en: 'Shabadoo' }, pl: 'sza ba da sza ba da ba', en: 'shabadoo shabadoo bah', n: [[4, 0.25], [2, 0.25], [0, 0.5], [5, 0.25], [4, 0.25], [2, 0.5], [0, 1]] },
  { id: 'f4', cat: 'fast', name: { pl: 'Dibi dibi w dół', en: 'Dibby dibby down' }, pl: 'di bi di bi di bi di bi du ba', en: 'dibby dibby dibby dibby doo bah', n: [[7, 0.25], [6, 0.25], [5, 0.25], [4, 0.25], [3, 0.25], [2, 0.25], [1, 0.25], [0, 0.25], [1, 0.5], [0, 1]] },
  { id: 'f5', cat: 'fast', name: { pl: 'Chromatyczny bieg', en: 'Chromatic run' }, pl: 'di ba di ba di ba du', en: 'dee bah dee bah dee bah doo', n: [[4, 0.25], [4, 0.25, -1], [3, 0.25], [2, 0.25, 1], [2, 0.25], [1, 0.25], [0, 1]] },
  { id: 'f6', cat: 'fast', name: { pl: 'Karabin', en: 'Machine gun' }, pl: 'da ba da ba da ba da ba dap', en: 'daba daba daba daba dat', n: [[0, 0.25], [2, 0.25], [0, 0.25], [2, 0.25], [4, 0.25], [2, 0.25], [4, 0.25], [5, 0.25], [7, 1]] },
  { id: 'f7', cat: 'fast', name: { pl: 'Sku bi du', en: 'Scooby doo' }, pl: 'sku bi du bi du ba', en: 'scooby doobie doo bah', n: [[2, 0.25], [4, 0.25], [5, 0.5], [4, 0.25], [2, 0.25], [0, 0.5]] },
  { id: 'f8', cat: 'fast', name: { pl: 'Pytanie i odpowiedź', en: 'Call and answer' }, pl: 'ba du bap ba du bap di bi di bi du', en: 'bah doo bop bah doo bop dibby dibby doo', n: [[0, 0.25], [2, 0.25], [4, 0.5], [null, 0.5], [4, 0.25], [5, 0.25], [7, 0.5], [null, 0.5], [7, 0.25], [5, 0.25], [4, 0.25], [2, 0.25], [0, 1]] },
  { id: 'f9', cat: 'fast', name: { pl: 'Triole', en: 'Triplets' }, pl: 'ba da ba ba da ba ba da ba du', en: 'bada bah bada bah bada bah doo', n: [[0, T], [2, T], [4, T], [2, T], [4, T], [5, T], [4, T], [5, T], [7, T], [4, 1]] },
  { id: 's1', cat: 'swing', name: { pl: 'Du ła', en: 'Doo wah' }, pl: 'du ła du ła du bi du ła', en: 'doo wah doo wah doo bee doo wah', n: [[0, 2 * T], [4, T], [0, 2 * T], [4, T], [2, 2 * T], [4, T], [5, 2 * T], [7, 1 + T]] },
  { id: 's2', cat: 'swing', name: { pl: 'Leniwy spacer', en: 'Lazy walk' }, pl: 'ba du ba du bi du ba', en: 'bah doo bah doo bee doo bah', n: [[4, 2 * T], [2, T], [4, 2 * T], [5, T], [4, 2 * T], [2, T], [0, 2]] },
  { id: 's3', cat: 'swing', name: { pl: 'Bebop', en: 'Bebop' }, pl: 'bi bap u bi du bap', en: 'bee bop ooh bee doo bop', n: [[7, 2 * T], [4, T], [5, 2 * T], [4, T], [2, 2 * T], [0, 1 + T]] },
  { id: 's4', cat: 'swing', name: { pl: 'Blue nuta', en: 'Blue note' }, pl: 'ła du ba di ja', en: 'wah doo bah dee yah', n: [[4, 1], [2, 2 * T, 1], [2, T], [0, 2 * T], [0, 1 + T, 0]] },
  { id: 's5', cat: 'swing', name: { pl: 'Zwi ba dap', en: 'Zwee bah dat' }, pl: 'zwi ba dap zwi ba dap du', en: 'zwee bah dat zwee bah dat doo', n: [[5, 2 * T], [4, T], [2, 1], [4, 2 * T], [2, T], [0, 1], [0, 2]] },
  { id: 'd1', cat: 'doowop', name: { pl: 'Szu bap', en: 'Shoo bop' }, pl: 'szu bap szu bap szu ba du ła', en: 'shoo bop shoo bop shoo bah doo wah', n: [[0, 0.5], [2, 0.5], [0, 0.5], [2, 0.5], [4, 0.5], [2, 0.5], [0, 0.5], [4, 1.5]] },
  { id: 'd2', cat: 'doowop', name: { pl: 'Bom bom', en: 'Bom bom' }, pl: 'bom bom bom di di bom', en: 'bom bom bom dee dee bom', n: [[0, 1], [0, 0.5], [4, 1], [5, 0.25], [5, 0.25], [4, 1]] },
  { id: 'd3', cat: 'doowop', name: { pl: 'Ram a lam', en: 'Ram a lam' }, pl: 'ram a lam a ding dong', en: 'ram a lam a ding dong', n: [[4, 0.5], [4, 0.25], [5, 0.5], [4, 0.25], [2, 0.5], [0, 1]] },
  { id: 'd4', cat: 'doowop', name: { pl: 'U ła u', en: 'Ooh wah ooh' }, pl: 'u ła u ła u', en: 'ooh wah ooh wah ooh', n: [[4, 1], [5, 1], [4, 1], [2, 1], [0, 2]] },
  { id: 'd5', cat: 'doowop', name: { pl: 'Dip dip dip', en: 'Dip dip dip' }, pl: 'dip dip dip du ła', en: 'dip dip dip doo wah', n: [[4, 0.5], [4, 0.5], [4, 0.5], [2, 0.5], [0, 2]] },
  { id: 'h1', cat: 'shout', name: { pl: 'Hej!', en: 'Hey!' }, pl: 'hej', en: 'hey', n: [[4, 1]] },
  { id: 'h2', cat: 'shout', name: { pl: 'Hej ho', en: 'Hey ho' }, pl: 'hej ho hej ho', en: 'hey ho hey ho', n: [[4, 1], [0, 1], [4, 1], [0, 1]] },
  { id: 'h3', cat: 'shout', name: { pl: 'Je je je', en: 'Yeah yeah yeah' }, pl: 'je je je', en: 'yeah yeah yeah', n: [[4, 0.5], [4, 0.5], [7, 2]] },
  { id: 'h4', cat: 'shout', name: { pl: 'O o o', en: 'Oh oh oh' }, pl: 'o o o o', en: 'oh oh oh oh', n: [[7, 0.5], [5, 0.5], [4, 0.5], [2, 1.5]] },
  { id: 'h5', cat: 'shout', name: { pl: 'Na na na', en: 'Na na na' }, pl: 'na na na na hej hej', en: 'na na na na hey hey', n: [[4, 0.5], [4, 0.5], [5, 0.5], [4, 0.5], [2, 1], [0, 1]] },
  { id: 'l1', cat: 'lala', name: { pl: 'La la w górę', en: 'La la up' }, pl: 'la la la la la', en: 'la la la la la', n: [[0, 0.5], [1, 0.5], [2, 0.5], [4, 0.5], [7, 2]] },
  { id: 'l2', cat: 'lala', name: { pl: 'Tra la la', en: 'Tra la la' }, pl: 'tra la la tra la la la', en: 'tra la la tra la la la', n: [[4, 0.5], [5, 0.25], [4, 0.75], [2, 0.5], [4, 0.25], [2, 0.75], [0, 1.5]] },
  { id: 'l3', cat: 'lala', name: { pl: 'Kołysanka', en: 'Lullaby' }, pl: 'lu li lu li la', en: 'lu li lu li la', n: [[4, 1], [2, 1], [4, 1], [2, 1], [0, 2]] },
  { id: 'l4', cat: 'lala', name: { pl: 'Pa ra ra', en: 'Pa ra ra' }, pl: 'pa ra ra pa ra ra pam pam', en: 'pa ra ra pa ra ra pam pam', n: [[0, 0.5], [2, 0.25], [4, 0.75], [2, 0.5], [4, 0.25], [5, 0.75], [4, 0.5], [0, 1]] },
  { id: 'l5', cat: 'lala', name: { pl: 'Fanfara', en: 'Fanfare' }, pl: 'ta ta ta ta', en: 'ta ta ta ta', n: [[0, 0.5], [0, 0.25], [0, 0.25], [4, 2]] },
  { id: 'x1', cat: 'fill', name: { pl: 'Bum ka', en: 'Boom ka' }, pl: 'bum ka bum bum ka', en: 'boom ka boom boom ka', n: [[0, 0.5], [4, 0.5], [0, 0.25], [0, 0.25], [4, 1]] },
  { id: 'x2', cat: 'fill', name: { pl: 'Ta ka ta ka', en: 'Ta ka ta ka' }, pl: 'ta ka ta ka ta ka dum', en: 'ta ka ta ka ta ka dum', n: [[4, 0.25], [4, 0.25], [4, 0.25], [4, 0.25], [2, 0.25], [2, 0.25], [0, 1]] },
  { id: 'x3', cat: 'fill', name: { pl: 'Zjazd', en: 'Slide down' }, pl: 'ła', en: 'wah', n: [[7, 2]] },
  { id: 'x4', cat: 'fill', name: { pl: 'Dum dum dap', en: 'Dum dum dat' }, pl: 'dum dum dap', en: 'dum dum dat', n: [[0, 0.5], [0, 0.5], [4, 1]] },
  { id: 'o1', cat: 'long', name: { pl: 'Uuu', en: 'Ooh' }, pl: 'u', en: 'ooh', n: [[4, 4]] },
  { id: 'o2', cat: 'long', name: { pl: 'Aaa w górę', en: 'Aah rising' }, pl: 'a a a', en: 'aah aah aah', n: [[0, 2], [2, 2], [4, 4]] },
  { id: 'o3', cat: 'long', name: { pl: 'Amen', en: 'Amen' }, pl: 'a men', en: 'ah men', n: [[3, 2], [2, 2]] },
  { id: 'o4', cat: 'long', name: { pl: 'O o', en: 'Oh oh' }, pl: 'o o', en: 'oh oh', n: [[7, 2], [4, 2]] },
  { id: 't1', cat: 'talk', spoken: true, name: { pl: 'Dobry wieczór', en: 'Good evening' }, pl: 'dobry wieczór wszystkim', en: 'good evening everybody' },
  { id: 't2', cat: 'talk', spoken: true, name: { pl: 'Raz dwa trzy', en: 'One two three' }, pl: 'raz dwa trzy cztery', en: 'one two three four' },
  { id: 't3', cat: 'talk', spoken: true, name: { pl: 'Dziękujemy', en: 'Thank you' }, pl: 'dziękujemy bardzo', en: 'thank you very much' },
  { id: 't4', cat: 'talk', spoken: true, name: { pl: 'Czy mnie słychać?', en: 'Can you hear me?' }, pl: 'czy mnie słychać?', en: 'can you hear me?' },
];

export const BEATS = [
  { id: 'auto', name: { pl: 'Automatyczny', en: 'Automatic' }, text: '' },
  { id: 'boots', name: { pl: 'Boots and cats', en: 'Boots and cats' }, text: 'B . t . | Pf . t . | B . t . | Pf . t .' },
  { id: 'four', name: { pl: 'Cztery na podłogę', en: 'Four on the floor' }, text: 'B . t . | B . tss . | B . t . | B . tss .' },
  { id: 'break', name: { pl: 'Breakbeat', en: 'Breakbeat' }, swing: 0.18, text: 'B . t . | Pf . t B | . B t . | Pf . t t' },
  { id: 'rim', name: { pl: 'Rimshot shuffle', en: 'Rimshot shuffle' }, swing: 0.4, text: 'B . t K | . t B . | t . K t | . B K t' },
  { id: 'inward', name: { pl: 'Werbel na wdechu', en: 'Inward snare' }, text: 'B . t . | ^K . t . | B B t . | ^K . t .' },
  { id: 'clicks', name: { pl: 'Kliki i cmoki', en: 'Clicks and pops' }, swing: 0.25, text: 'B . ! . | P! . ! . | B ! . ! | P! . ! !' },
  { id: 'hum', name: { pl: 'Mruczany bas', en: 'Hum bass' }, swing: 0.1, text: 'B m . m:43 | Pf . m:45 . | B m:40 . m | Pf . t kch' },
  { id: 'boombap', name: { pl: 'Boom bap', en: 'Boom bap' }, text: 'B . . . | Pf . . B | . B . . | Pf . t .' },
  { id: 'half', name: { pl: 'Half-time', en: 'Half-time' }, text: 'B . . t | . . t . | Pf . . t | . t . .' },
  { id: 'dembow', name: { pl: 'Dembow', en: 'Dembow' }, text: 'B . . Pf | . . Pf . | B . . Pf | . . Pf .' },
  { id: 'dnb', name: { pl: 'Drum and bass', en: 'Drum and bass' }, text: 'B . . . | Pf . . . | . . B . | Pf . . .' },
  { id: 'clave', name: { pl: 'Clave', en: 'Clave' }, text: '! . . ! | . . ! . | . . ! . | ! . . .' },
  { id: 'kick', name: { pl: 'Sama stopa', en: 'Kick only' }, text: 'B . . . | B . . . | B . . . | B . . .' },
  { id: 'crash', name: { pl: 'Z talerzem', en: 'With a crash' }, text: 'kch . . . | Pf . t . | B . t . | Pf . t . | B . t . | Pf . t . | B . t . | Pf . t t' },
  { id: 'rimwalk', name: { pl: 'Rimshoty', en: 'Rimshots' }, text: 'B . K . | . K . . | B . K . | K . t .' },
  { id: 'popcorn', name: { pl: 'Popcorn', en: 'Popcorn' }, text: 'P! . ! P! | . ! P! . | ! . P! ! | P! . ! .' },
];

export const BEAT_KIT = [
  ['B', { pl: 'stopa', en: 'kick' }], ['t', { pl: 'hi-hat', en: 'hi-hat' }], ['tss', { pl: 'otwarty hat', en: 'open hat' }], ['Pf', { pl: 'werbel', en: 'snare' }], ['K', { pl: 'rimshot', en: 'rimshot' }],
  ['^K', { pl: 'werbel na wdechu', en: 'inward snare' }], ['!', { pl: 'klik językiem', en: 'tongue click' }], ['P!', { pl: 'cmok', en: 'lip pop' }], ['kch', { pl: 'talerz', en: 'crash' }], ['m', { pl: 'mruk (m:43 = nuta)', en: 'hum (m:43 = note)' }],
];

export const BASSES = [
  { id: '', name: { pl: 'Automatyczny', en: 'Automatic' } },
  { id: 'walk', name: { pl: 'Kroczący', en: 'Walking' } },
  { id: 'doowop', name: { pl: 'Bom bom', en: 'Bom bom' } },
  { id: 'octave', name: { pl: 'Oktawy', en: 'Octaves' } },
  { id: 'reggae', name: { pl: 'Reggae', en: 'Reggae' } },
  { id: 'funk', name: { pl: 'Funk', en: 'Funk' } },
  { id: 'pulse', name: { pl: 'Puls', en: 'Pulse' } },
  { id: 'ballad', name: { pl: 'Ballada', en: 'Ballad' } },
  { id: 'hymn', name: { pl: 'Hymn', en: 'Hymn' } },
  { id: 'drone', name: { pl: 'Mruczany dron', en: 'Hummed drone' } },
];

export const STARTERS = [
  { id: 'scat', name: { pl: 'Scat jam', en: 'Scat jam' }, mood: 'happy', bpm: 96, beat: 'boots', bass: 'walk', heads: [['lead', 'baritone', 'wire'], ['bass', 'bass', 'wire'], ['beatbox', 'baritone', 'wire']], lines: ['f1', 'f8', 's1', 'f4', 'h3'] },
  { id: 'doowop', name: { pl: 'Doo-wop', en: 'Doo-wop' }, mood: 'ballad', bpm: 84, beat: '', bass: 'doowop', heads: [['lead', 'tenor', 'wire'], ['harmony', 'alto', 'wire'], ['choir', 'tenor', 'wire'], ['bass', 'bass', 'wire']], lines: ['d1', 'd4', 'd3', 'd5'] },
  { id: 'cypher', name: { pl: 'Beatbox', en: 'Beatbox' }, mood: 'dark', bpm: 92, beat: 'break', bass: 'drone', heads: [['lead', 'baritone', 'wire'], ['beatbox', 'baritone', 'wire'], ['beatbox', 'tenor', 'wire'], ['bass', 'bass', 'wire']], lines: ['x1', 'x2', 'f6', 'x4'] },
  { id: 'robots', name: { pl: 'Robot funk', en: 'Robot funk' }, mood: 'dark', bpm: 110, beat: 'four', bass: 'funk', heads: [['lead', 'tenor', 'robot'], ['harmony', 'baritone', 'robot', { harm: 'oct' }], ['bass', 'bass', 'robot'], ['beatbox', 'baritone', 'wire']], lines: ['f2', 'f7', 'f5', 'h2'] },
  { id: 'choir', name: { pl: 'Chór', en: 'Choir' }, mood: 'hymn', bpm: 70, beat: '', bass: 'hymn', heads: [['lead', 'soprano', 'wire'], ['choir', 'alto', 'wire'], ['choir', 'tenor', 'wire'], ['bass', 'bass', 'wire']], lines: ['o2', 'l3', 'o3'] },
  { id: 'zoo', name: { pl: 'Zwierzyniec', en: 'Menagerie' }, mood: 'happy', bpm: 100, beat: 'clicks', bass: '', heads: [['lead', 'tenor', 'wire'], ['inst', 'tenor', 'wire', { inst: 'bird' }], ['inst', 'tenor', 'wire', { inst: 'seal' }], ['inst', 'bass', 'wire', { inst: 'gator' }], ['beatbox', 'baritone', 'wire']], lines: ['l1', 'l2', 'l4', 'h5'] },
];

export function phraseSyllables(p) { return p.n ? p.n.filter((x) => x[0] !== null).length : 0; }

export function phraseMelody(p, stepToMidi) {
  let b = 0, i = 0;
  const notes = [];
  for (const [step, beats, alt] of p.n) {
    if (step !== null) notes.push({ i: i++, b: +b.toFixed(4), d: +(beats * 0.96).toFixed(4), m: stepToMidi(step) + (alt || 0) });
    b += beats;
  }
  return { bars: Math.max(1, Math.ceil((b - 1e-6) / 4)), notes };
}
