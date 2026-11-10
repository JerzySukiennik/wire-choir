# Spectrogram PNGs for rendered test WAVs.
import sys, wave
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

for path in sys.argv[1:]:
    w = wave.open(path)
    fs = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    fig, ax = plt.subplots(2, 1, figsize=(14, 6), gridspec_kw={'height_ratios': [1, 3]})
    ax[0].plot(np.arange(len(x)) / fs, x, lw=0.3)
    ax[0].set_xlim(0, len(x) / fs)
    ax[1].specgram(x, NFFT=1024, Fs=fs, noverlap=896, cmap='magma', vmin=-110)
    ax[1].set_ylim(0, 8000)
    fig.tight_layout()
    fig.savefig(path.replace('.wav', '.png'), dpi=70)
    plt.close(fig)
