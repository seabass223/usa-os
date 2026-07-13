const BEAR_SPRITES = {
  idle: "./assets/images/bear-idle.png",
  attacking: "./assets/images/bear-attack.png",
  hit: "./assets/images/bear-hit.png",
};
const BEAR_MAX_HEALTH = 700;
const STARTING_AMMO = 120;
const FIREWORK_DAMAGE = 7;
const EAGLE_STRIKE_DAMAGE = 85;
const EAGLE_STRIKE_LIMIT = 3;
const BEAR_ATTACK_DAMAGE = 30;
const BATTLE_INTRO_DURATION = 3200;
const SHELF_TARGETS = ["#intro-screen", ".usa-header", "#game"];

export class EndBossBattle {
  constructor({ overlay, state, fireworks, popSounds, eagleSounds, backgroundMusic, bossMusic }) {
    this.overlay = overlay;
    this.stateRef = state;
    this.fireworks = fireworks;
    this.popSounds = popSounds;
    this.eagleSounds = eagleSounds;
    this.backgroundMusic = backgroundMusic;
    this.bossMusic = bossMusic;
    this.state = {
      active: false,
      concluded: false,
      life: 100,
      ammo: 25,
      bearHealth: 100,
      eagleStrikes: EAGLE_STRIKE_LIMIT,
      attacking: false,
      defended: false,
    };
    this.attackTimer = null;
    this.attackWindow = null;
    this.transitionTimer = null;
    this.fadeTimer = null;
    this.refs = {
      message: overlay.querySelector("#end-boss-message"),
      result: overlay.querySelector("#end-boss-result"),
      life: overlay.querySelector("#boss-life-meter"),
      ammo: overlay.querySelector("#boss-ammo-meter"),
      cash: overlay.querySelector("#boss-cash-source"),
      production: overlay.querySelector("#boss-production-source"),
      health: overlay.querySelector("#bear-health-meter"),
      eagleStrikeMeter: overlay.querySelector("#eagle-strike-meter"),
      bear: overlay.querySelector(".bear-sprite"),
      defend: overlay.querySelector("#defend-button"),
      eagleStrike: overlay.querySelector("#eagle-strike-button"),
    };
    this.overlay.addEventListener("click", (event) => this.shoot(event));
    this.refs.defend.addEventListener("click", (event) => {
      event.stopPropagation();
      this.defend();
    });
    this.refs.eagleStrike.addEventListener("click", (event) => {
      event.stopPropagation();
      this.eagleStrike();
    });
  }

  start({ cheat = false } = {}) {
    if (this.state.active || this.state.concluded || this.transitionTimer) return;
    this.prepareFinaleTransition();
    this.refs.message.textContent = cheat
      ? "CHEAT ACCEPTED: A NEW PLAYER HAS ENTERED THE SIMULATION"
      : "A NEW PLAYER HAS ENTERED THE SIMULATION";
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      this.beginBattle();
    }, BATTLE_INTRO_DURATION);
  }

  prepareFinaleTransition() {
    document.body.classList.remove("end-boss-active", "end-boss-won", "end-boss-lost", "end-boss-transition-complete");
    this.refs.bear.classList.remove("bear-intro");
    document.body.classList.add("end-boss-transition");
    SHELF_TARGETS.forEach((selector, index) => {
      const element = document.querySelector(selector);
      if (!element) return;
      element.classList.remove("shelf-knockoff");
      element.style.setProperty("--shelf-delay", `${index * 1000}ms`);
      void element.offsetWidth;
      element.classList.add("shelf-knockoff");
    });
    this.fadeOutMusic();
  }

  fadeOutMusic() {
    if (!this.backgroundMusic) return;
    window.clearInterval(this.fadeTimer);
    const startVolume = Number.isFinite(this.backgroundMusic.volume) ? this.backgroundMusic.volume : 0.45;
    this.backgroundMusic.volume = Math.max(0, startVolume * 0.72);
    const startedAt = performance.now();
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / 2200);
      this.backgroundMusic.volume = Math.max(0, startVolume * (1 - progress));
      if (progress >= 1) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        this.backgroundMusic.pause();
        this.backgroundMusic.currentTime = 0;
      }
    }, 100);
  }

  startBossMusic() {
    if (!this.bossMusic || document.body.classList.contains("boss-mode")) return;
    this.bossMusic.currentTime = 0;
    this.bossMusic.volume = 0.62;
    this.bossMusic.muted = false;
    this.bossMusic.play().catch(() => {
      // Playback remains optional if the browser blocks audio.
    });
  }

  stopBossMusic() {
    if (!this.bossMusic) return;
    this.bossMusic.pause();
    this.bossMusic.currentTime = 0;
  }

  beginBattle() {
    const stats = this.stateRef.stats;
    const production = Math.max(1, stats.cyclesPerSecond + stats.deployPerSecond);
    this.state = {
      active: true,
      concluded: false,
      life: 100,
      ammo: STARTING_AMMO,
      bearHealth: BEAR_MAX_HEALTH,
      eagleStrikes: EAGLE_STRIKE_LIMIT,
      attacking: false,
      defended: false,
    };
    this.refs.result.textContent = "Russian Bear end boss online. Click to fire fireworks. Defend when he lunges.";
    this.refs.cash.textContent = `FORMER CASH: ${formatFull(this.stateRef.progress)}`;
    this.refs.production.textContent = `FORMER PRODUCTION: ${formatFull(production)} / sec`;
    this.refs.defend.disabled = true;
    this.refs.eagleStrike.disabled = false;
    this.refs.bear.classList.add("bear-intro");
    window.setTimeout(() => this.refs.bear.classList.remove("bear-intro"), 950);
    this.setBearState("idle");
    this.overlay.hidden = false;
    document.body.classList.add("end-boss-active", "end-boss-transition-complete");
    document.body.classList.remove("end-boss-transition", "end-boss-won", "end-boss-lost");
    this.render();
    this.startBossMusic();
    window.clearInterval(this.attackTimer);
    this.attackTimer = window.setInterval(() => this.forceAttack(), 2600);
  }

  shoot(event) {
    if (!this.state.active || this.state.concluded) return;
    if (event.target.closest("#defend-button")) return;
    if (this.state.ammo <= 0) {
      this.refs.result.textContent = "AMMO EMPTY — wait for production to recycle fireworks.";
      return;
    }
    this.state.ammo -= 1;
    this.state.defended = false;
    this.refs.result.textContent = "Bottle rocket launched — track the stream to impact.";
    this.render();
    this.launchBottleRocket(event.clientX, event.clientY);
  }

  eagleStrike() {
    if (!this.state.active || this.state.concluded || this.state.eagleStrikes <= 0) return;
    this.state.eagleStrikes -= 1;
    this.refs.eagleStrike.disabled = this.state.eagleStrikes <= 0;
    this.eagleSounds?.play();
    this.launchEagleStrike();
    this.state.bearHealth = Math.max(0, this.state.bearHealth - EAGLE_STRIKE_DAMAGE);
    this.setBearState("hit");
    this.refs.result.textContent = "Eagle strike connected. The bear reels from a freedom dive.";
    this.fireworks?.burst(window.innerWidth * 0.5, window.innerHeight * 0.38, {
      colors: ["#ffffff", "#ffd86b", "#2878d0"],
      particleCount: 30,
    });
    this.render();
    if (this.state.bearHealth <= 0) {
      this.win();
      return;
    }
    window.setTimeout(() => {
      if (this.state.active && !this.state.attacking) this.setBearState("idle");
    }, 320);
  }

  launchEagleStrike() {
    const eagle = document.createElement("span");
    eagle.className = "eagle-strike";
    eagle.setAttribute("aria-hidden", "true");
    this.overlay.append(eagle);
    window.setTimeout(() => eagle.remove(), 1200);
  }

  forceAttack() {
    if (!this.state.active || this.state.concluded || this.state.attacking) return;
    this.state.attacking = true;
    this.state.defended = false;
    this.refs.defend.disabled = false;
    this.refs.result.textContent = "BEAR ATTACK INBOUND — CLICK DEFEND NOW.";
    this.setBearState("attacking");
    window.clearTimeout(this.attackWindow);
    this.attackWindow = window.setTimeout(() => {
      if (!this.state.active || this.state.concluded) return;
      if (!this.state.defended) {
        this.state.life = Math.max(0, this.state.life - BEAR_ATTACK_DAMAGE);
        this.refs.result.textContent = "Defense missed. Life systems took a massive hit.";
      }
      this.state.attacking = false;
      this.refs.defend.disabled = true;
      this.setBearState("idle");
      this.render();
      if (this.state.life <= 0) this.lose();
    }, 900);
  }

  defend() {
    if (!this.state.active || !this.state.attacking || this.state.concluded) return;
    this.state.defended = true;
    this.state.attacking = false;
    this.refs.defend.disabled = true;
    window.clearTimeout(this.attackWindow);
    this.refs.result.textContent = "Defense successful. Bear attack blocked.";
    this.setBearState("idle");
    this.render();
  }

  win() {
    if (this.state.concluded) return;
    this.state.active = false;
    this.state.concluded = true;
    this.state.bearHealth = 0;
    window.clearInterval(this.attackTimer);
    window.clearTimeout(this.attackWindow);
    this.refs.defend.disabled = true;
    this.refs.eagleStrike.disabled = true;
    this.stopBossMusic();
    this.setBearState("hit");
    this.refs.message.textContent = "BEAR DEFEATED";
    this.refs.result.textContent = "USA-OS FINAL VICTORY — congratulations, operator. The timeline holds.";
    document.body.classList.add("end-boss-won");
    this.render();
    this.fireworks?.celebrateFullscreen({
      bursts: 54,
      duration: 4200,
      onBurst: () => this.popSounds?.play(),
    });
  }

  lose() {
    if (this.state.concluded) return;
    this.state.active = false;
    this.state.concluded = true;
    this.state.life = 0;
    window.clearInterval(this.attackTimer);
    window.clearTimeout(this.attackWindow);
    this.refs.defend.disabled = true;
    this.refs.eagleStrike.disabled = true;
    this.stopBossMusic();
    this.setBearState("attacking");
    this.refs.message.textContent = "TIMELINE OVERRUN";
    this.refs.result.textContent = "Life dropped to zero. The United States has been lost to the USSR.";
    document.body.classList.add("end-boss-lost");
    this.render();
  }

  setBearState(state) {
    if (state !== "idle") this.refs.bear.classList.remove("bear-intro");
    this.refs.bear.classList.remove("idle", "attacking", "hit");
    this.refs.bear.classList.add(state);
    this.refs.bear.dataset.state = state;
    this.refs.bear.src = BEAR_SPRITES[state] ?? BEAR_SPRITES.idle;
  }

  launchBottleRocket(targetX, targetY) {
    const impactX = clamp(targetX, 0, window.innerWidth);
    const impactY = clamp(targetY, 0, window.innerHeight);
    const startX = clamp(targetX, 64, window.innerWidth - 64);
    const startY = window.innerHeight + 32;
    const rocket = document.createElement("span");
    rocket.className = "bear-rocket";
    rocket.style.setProperty("--start-x", `${startX}px`);
    rocket.style.setProperty("--start-y", `${startY}px`);
    rocket.style.setProperty("--target-x", `${impactX}px`);
    rocket.style.setProperty("--target-y", `${impactY}px`);
    this.overlay.append(rocket);
    window.setTimeout(() => {
      rocket.remove();
      this.resolveRocketImpact(impactX, impactY);
    }, 520);
  }

  resolveRocketImpact(x, y) {
    if (!this.state.active || this.state.concluded) return;
    this.state.bearHealth = Math.max(0, this.state.bearHealth - FIREWORK_DAMAGE);
    this.popSounds?.play();
    this.fireworks?.burst(x, y, {
      colors: ["#d52b1e", "#ffffff", "#2878d0"],
      particleCount: 24,
    });
    this.setBearState("hit");
    this.refs.result.textContent = "Bottle rocket impact. Bear armor integrity falling.";
    this.render();
    if (this.state.bearHealth <= 0) {
      this.win();
      return;
    }
    window.setTimeout(() => {
      if (this.state.active && !this.state.attacking) this.setBearState("idle");
    }, 260);
  }

  render() {
    this.refs.life.textContent = `LIFE ${Math.round(this.state.life)}`;
    this.refs.ammo.textContent = `AMMO ${Math.round(this.state.ammo)}`;
    this.refs.health.textContent = `BEAR ${Math.round(this.state.bearHealth)}`;
    this.refs.eagleStrikeMeter.textContent = `EAGLE STRIKES ${this.state.eagleStrikes}`;
    this.refs.life.style.setProperty("--meter", `${this.state.life}%`);
    this.refs.ammo.style.setProperty("--meter", `${(this.state.ammo / STARTING_AMMO) * 100}%`);
    this.refs.health.style.setProperty("--meter", `${(this.state.bearHealth / BEAR_MAX_HEALTH) * 100}%`);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatFull(value) {
  return Math.round(value).toLocaleString();
}
