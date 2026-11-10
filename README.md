# Wire Choir

Type a line and wireframe heads sing it. The voice is a physical model of the human airway: lungs, vocal folds, a branched vocal tract, lips and nose, simulated sample by sample. Nothing is sampled. The heads move with the same articulation that makes the sound, so the tongue, jaw, lips and larynx you see are what you hear.

Live: https://choir.gzowo.fun

## The voice

The singing, speech, beatbox and animal voices come from [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) by Jameson Hodge (MIT): a Rust engine with an FDTD airway, compiled to WebAssembly (`assets/chimera/chimera.wasm`, built from commit `eed4a5f`, see `Niepotrzebne/tools/build-chimera-kaggle.py`). One voice costs about half a CPU core in real time, so Wire Choir does not run it live for six heads. Every head's part is cut into units (a phrase, a bar of bass, a bar of beatbox), each unit is rendered once in a Web Worker and cached in memory and IndexedDB, and playback is plain sample-accurate buffer scheduling. Repeated lines and bars cost nothing, and playback starts as soon as the remaining units are sure to arrive in time.

The first voice engine written for this project (an LF glottal source feeding a Kelly-Lochbaum waveguide, `js/voice/`) is still used where a wait is impossible: live keys and MIDI in the Play window, and note previews in the Notes window.

## What it does

- Polish and English lyrics, turned into syllables with stress and sung on an automatic melody with chords.
- Up to six heads with roles: lead, harmony, choir, bass, beatbox and instrument. Each head has its own body (male, female and child blend continuously), voice and look (Wireframe, Robot, Ghost, Jurek).
- Beatbox is real mouth percussion: kick, hi-hat, open hat, snare, rimshot, inward snare, tongue click, lip pop, crash and a hummed bass note, written as patterns like `B . t . | Pf . t .`.
- Instruments are sung with the mouth (synth, guitar, keys, brass, strings, organ, flute, each with its own syllables and pattern) or by animals: songbird, seal, alligator, elephant.
- A line that starts with `>` is spoken instead of sung, with a statement or question melody.
- Blocks: ready scat phrases, shouts, tunes, fills, beat and bass patterns and starter sets to arrange a song from. Phrases carry their melody in scale steps, so they follow the key and mood of your song.
- Enter sings the typed line, Shift+Enter adds it to the song, Space plays the whole song.
- Side windows: Heads, Song, Notes (piano roll editing), Play (on-screen keys, computer keys, Web MIDI, recording), Blocks, Listen, Export (song link, WAV, MP4 video 9:16 or 16:9).
- Listen: play a song next to the microphone or open an audio file and pick an excerpt on the waveform. The choir hears the instruments and the genre (YAMNet), the words with their timing and the language (Whisper), then sets up the heads by itself (lead voice and look, harmony, bass, beatbox, instruments) and rebuilds the excerpt: tempo and beat grid, the lead melody, the bass line, the drum pattern (split between beatbox heads: kick on one, snare and hats on the other), key and chords. The words are laid onto the melody so stressed syllables land on the accented notes. Everything runs in the browser (`js/listen.js`: harmonic-sum pitch salience with Viterbi tracking, spectral-flux onsets and band onsets for drums, Krumhansl key profiles, a second masked line for riffs; `js/listen-ml.js`: the two models). The recognized words fill the words box and can be edited; edited words are laid onto the melody by stress instead of by time.

No build step. Open `index.html` through any static server. `lab.html` is the voice lab, `warianty.html` the early UI studies.

## Credits and licenses

- Pronunciations: a subset of the CMU Pronouncing Dictionary, Carnegie Mellon University, BSD-style license (`data/cmudict-LICENSE.txt`).
- Voice engine: CHIMERA by Jameson Hodge, MIT (`assets/chimera/LICENSE.txt`). Seven of the beat patterns in the Blocks window are its presets.
- 3D: three.js (MIT), loaded from jsDelivr.
- Instrument and genre tagging: YAMNet by Google (Apache 2.0), TensorFlow.js model in `assets/yamnet/`, run with TensorFlow.js (Apache 2.0) from jsDelivr.
- Words and language: OpenAI Whisper (MIT), ONNX builds `onnx-community/whisper-base_timestamped` and `whisper-tiny_timestamped` from Hugging Face, run with Transformers.js (Apache 2.0) from jsDelivr.
- The Jurek avatar (`assets/jurek-head.glb`) is a hand-built model of the author, published with his consent. Do not reuse it elsewhere.
- Everything else (the light voice engine, phonology, composer, listening, heads, robot) is original code in this repository.
