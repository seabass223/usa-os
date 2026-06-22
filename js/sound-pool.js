export class SoundPool {
  constructor(source, { initialSize = 6, volume = 1 } = {}) {
    this.source = source;
    this.volume = volume;
    this.voices = Array.from({ length: initialSize }, () => this.createVoice());
  }

  play() {
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

  createVoice() {
    const voice = new Audio(this.source);
    voice.preload = "auto";
    voice.volume = this.volume;
    return voice;
  }
}
