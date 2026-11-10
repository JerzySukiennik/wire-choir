# Kaggle CPU kernel: builds the CHIMERA engine (github.com/jamesondh/chimera-vocal-synth, MIT, commit eed4a5f) to wasm and renders reference clips. Output: out/chimera.wasm -> assets/chimera/chimera.wasm.
import json, os, shutil, subprocess
def sh(c):
    print('+', c, flush=True)
    subprocess.run(c, shell=True, check=True)
os.environ['PATH'] = os.path.expanduser('~/.cargo/bin') + ':' + os.environ['PATH']
sh('curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal')
sh('rustup target add wasm32-unknown-unknown')
sh('git clone https://github.com/jamesondh/chimera-vocal-synth /tmp/chimera && cd /tmp/chimera && git checkout eed4a5ff2695ad151df2210d012b2a4ab584f099')
os.chdir('/tmp/chimera')
sh('cargo build -p chimera-wasm --release --target wasm32-unknown-unknown')
sh('cargo build --release -p chimera-cli')
out = '/kaggle/working/out'
os.makedirs(out, exist_ok=True)
shutil.copy('target/wasm32-unknown-unknown/release/chimera_wasm.wasm', out + '/chimera.wasm')
sh('cargo run --release -q -p chimera --example bench 2>&1 | tee ' + out + '/bench.txt')
C = 'target/release/chimera'
atw = {'bpm': 121, 'vibrato': 20, 't0': 0.3, 'lyrics': 'around the world ' * 8, 'notes': [[55, 0.5], [55, 0.5], [57, 0.5], [55, 0.5]] * 8}
json.dump(atw, open('/tmp/atw.json', 'w'))
scat = {'bpm': 132, 'vibrato': 15, 't0': 0.3, 'lyrics': 'ba ba dee bee dee ba doo bop ba da ba doo dee ya da da', 'notes': [[60, 0.5], [60, 0.5], [63, 0.25], [65, 0.25], [67, 0.5], [65, 0.5], [63, 0.5], [60, 1], [67, 0.5], [65, 0.5], [63, 0.25], [65, 0.25], [63, 0.5], [60, 0.5], [58, 0.5], [60, 1.5]]}
json.dump(scat, open('/tmp/scat.json', 'w'))
for cmd in [
    f'{C} render text {out}/text-male.wav "Around the world, around the world. Good evening, everybody." male',
    f'{C} render text {out}/text-female.wav "Around the world, around the world. Good evening, everybody." female',
    f'{C} render notes /tmp/atw.json {out}/atw-male.wav male',
    f'{C} render notes /tmp/atw.json {out}/atw-female.wav female',
    f'{C} render notes /tmp/scat.json {out}/scat-male.wav male',
    f'{C} render beatbox {out}/beat',
    f'{C} render song {out}/song',
    f'{C} render vowels male {out}/vowels-male.wav',
    f'{C} render creature songbird {out}/creature',
    f'{C} --help || true',
]:
    try:
        sh(cmd + ' 2>&1 | tail -15')
    except Exception as e:
        print('FAILED', cmd, e)
sh('ls -la ' + out + ' ' + out + '/*')
