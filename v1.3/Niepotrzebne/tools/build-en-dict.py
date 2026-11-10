# Builds data/en-dict.txt: frequent English words from CMUdict, phones packed one char each.
import sys, re
src, freq, out = sys.argv[1], sys.argv[2], sys.argv[3]
words = set(w.strip() for w in open(freq) if w.strip())
extra = """i'm i'll i'd i've you're you'll you've you'd he's she's it's we're we'll we've they're they'll they've that's there's what's let's don't doesn't didn't can't won't wouldn't couldn't shouldn't isn't aren't wasn't weren't ain't haven't hasn't o'clock gonna wanna gotta tonight forever heartbeat heartbreak goodbye hello baby darling lonely tears shine glow sparkle sparkling wire wires choir singing sang sung dancing dreamer dreaming dreams starlight moonlight sunlight sunrise sunset midnight neon electric spark sparks whisper whispering echo echoes heartache yeah oh ooh la na hey whoa""".split()
words |= set(extra)
VOW = ['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW']
CON = ['B','CH','D','DH','F','G','HH','JH','K','L','M','N','NG','P','R','S','SH','T','TH','V','W','Y','Z','ZH']
codes = {}
c = 33
for v in VOW:
    for s in '012':
        codes[v + s] = chr(c); c += 1
for k in CON:
    codes[k] = chr(c); c += 1
assert c < 127
seen = {}
for line in open(src, encoding='utf-8'):
    line = line.split('#')[0].strip()
    if not line: continue
    parts = line.split()
    w = parts[0]
    base = re.sub(r'\(\d+\)$', '', w)
    if base != w: continue
    if base not in words or base in seen: continue
    seen[base] = ''.join(codes[p] for p in parts[1:])
with open(out, 'w') as f:
    f.write('#' + ' '.join(k for k in codes) + '\n')
    for w in sorted(seen):
        f.write(w + '\t' + seen[w] + '\n')
print(len(seen), 'words')
