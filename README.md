# Wire Choir

Type a line and wireframe heads sing it. The voice is a physical model of the vocal tract computed live in the browser: an LF glottal source feeding a Kelly-Lochbaum waveguide with a nasal branch, frication noise and plosive bursts. The heads move with the same articulation that makes the sound, so the tongue, jaw, lips and larynx you see are what you hear.

Live: https://choir.gzowo.fun

## What it does

- Polish and English lyrics, turned into syllables with stress and sung on an automatic melody with chords.
- Up to six heads with roles: lead, harmony, choir, bass, beatbox. Each head has its own voice and look (Wireframe, Robot, Ghost, Jurek).
- Enter sings the typed line, Shift+Enter adds it to the song, Space plays the whole song.
- Side windows: Heads, Song, Notes (piano roll editing), Play (on-screen keys, computer keys, Web MIDI, recording), Listen, Export (song link, WAV, MP4 video 9:16 or 16:9).
- Listen: play a song next to the microphone or open an audio file, pick an excerpt on the waveform and type the words. The choir rebuilds the excerpt: tempo and beat grid, the lead melody, the bass line, the drum pattern (split between beatbox heads: kick on one, snare and hats on the other), key and chords. The words are laid onto the melody so stressed syllables land on the accented notes. Everything runs in the browser (`js/listen.js`: harmonic-sum pitch salience with Viterbi tracking, spectral-flux onsets and band onsets for drums, Krumhansl key profiles).

No build step. Open `index.html` through any static server. `lab.html` is the voice lab, `warianty.html` the early UI studies.

## Credits and licenses

- Pronunciations: a subset of the CMU Pronouncing Dictionary, Carnegie Mellon University, BSD-style license (`data/cmudict-LICENSE.txt`).
- 3D: three.js (MIT), loaded from jsDelivr.
- The Jurek avatar (`assets/jurek-head.glb`) is a hand-built model of the author, published with his consent. Do not reuse it elsewhere.
- Everything else (voice engine, phonology, composer, heads, robot) is original code in this repository.
