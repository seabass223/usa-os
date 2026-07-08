export class SoundPool {
  constructor(source, { initialSize = 6, volume = 1 } = {}) {
    this.source = source;
    this.volume = volume;
    this.muted = false;
    this.voices = Array.from({ length: initialSize }, () => this.createVoice());
  }

  play() {
    if (this.muted) return;
    const voice = this.voices.find(
      (candidate) => candidate.paused || candidate.ended,
    ) ?? this.addVoice();

    voice.currentTime = 0;
    voice.play().catch(() => {
      // Sound effects remain optional if browser audio is blocked.
    });
  }

  addVoice() {
    const voice = this.createVoice();
    this.voices.push(voice);
    return voice;
  }

  setMuted(muted) {
    this.muted = muted;
    for (const voice of this.voices) {
      voice.muted = muted;
      if (muted) {
        voice.pause();
        voice.currentTime = 0;
      }
    }
  }

  createVoice() {
    const voice = new Audio(this.source);
    voice.preload = "auto";
    voice.volume = this.volume;
    voice.muted = this.muted;
    return voice;
  }
}
