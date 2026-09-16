Songdo Cosmic-Ray Interactive v3 (Offline)

Open index.html in a modern browser.

Low-energy flow (1 PeV / 10 PeV):
1. Air shower reaches Songdo array.
2. Click the activated detector footprint.
3. DRC event view animates particle entry, shower development, Cherenkov and scintillation light.
4. Optical waveforms and photon counts update live.
5. Continue to ML to visualize feature extraction, model inference and Particle ID.

High-energy flow (100 PeV / 10 EeV):
- Array performance placeholders for trigger efficiency, core reconstruction and energy reconstruction.

Important:
- DRC photon counts, waveforms, ML features and class probabilities are demonstration values for visualization only.
- Replace them with the team's actual DRC/ML outputs when available.
- No external libraries or internet connection are required.

[2026-09-10 ML pipeline update]
- Replaced the simplified generic ML classifier view with the requested convolutional U-Net structure.
- Added Encoder 1-4, MaxPool, 384-channel bottleneck, nearest-neighbor decoder, concat skip connections, 1x1 Conv, per-pixel EM/MU/HAD logits, Softmax fractions, and decomposed photon-map equations.
- Added an expandable residual ConvBlock diagram (3x3 Conv -> GroupNorm -> SiLU -> optional Dropout2D -> 3x3 Conv -> GroupNorm -> SiLU, plus identity/1x1 residual branch).
- The U-Net path animates when "Run U-Net" is pressed after the DRC event finishes.
- Composition numbers remain presentation/demo values until real ML inference output is connected.
