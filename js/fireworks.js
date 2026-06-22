const DEFAULT_COLORS = [
  "#d52b1e",
  "#ffffff",
  "#2878d0",
];

export class PixelFireworks {
  constructor({
    particleCount = 18,
    colors = DEFAULT_COLORS,
    lifetime = 520,
    gravity = 75,
  } = {}) {
    this.particleCount = particleCount;
    this.colors = colors;
    this.lifetime = lifetime;
    this.gravity = gravity;
    this.particles = [];
    this.pool = [];
    this.frame = null;
    this.lastTime = 0;
    this.celebrationTimers = new Set();
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "fireworks-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.context = this.canvas.getContext("2d", { alpha: true });
    document.body.append(this.canvas);

    this.resize = this.resize.bind(this);
    this.animate = this.animate.bind(this);
    this.resize();
    window.addEventListener("resize", this.resize, { passive: true });
  }

  burst(x, y, options = {}) {
    if (this.reducedMotion) return;

    const count = options.particleCount ?? this.particleCount;
    const colors = options.colors ?? this.colors;

    for (let index = 0; index < count; index += 1) {
      const particle = this.pool.pop() ?? {};
      const angle = (Math.PI * 2 * index) / count + random(-0.14, 0.14);
      const speed = random(75, 185);

      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.age = 0;
      particle.life = this.lifetime * random(0.75, 1.15);
      particle.color = colors[index % colors.length];
      particle.size = Math.random() < 0.25 ? 6 : 4;
      this.particles.push(particle);
    }

    if (this.frame === null) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.animate);
    }
  }

  celebrateFullscreen({ bursts = 14, duration = 1100, onBurst } = {}) {
    if (this.reducedMotion) return;

    for (let index = 0; index < bursts; index += 1) {
      const timer = window.setTimeout(() => {
        this.celebrationTimers.delete(timer);
        this.burst(
          random(this.width * 0.08, this.width * 0.92),
          random(this.height * 0.1, this.height * 0.82),
          { particleCount: 22 },
        );
        onBurst?.();
      }, (duration * index) / bursts);
      this.celebrationTimers.add(timer);
    }
  }

  attach(element, options = {}) {
    const handler = (event) => {
      if (event.button !== 0 || element.disabled) return;
      this.burst(event.clientX, event.clientY, options);
      options.onBurst?.(event);
    };
    element.addEventListener("pointerdown", handler, { passive: true });
    return () => element.removeEventListener("pointerdown", handler);
  }

  animate(now) {
    const delta = Math.min(0.034, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.context.clearRect(0, 0, this.width, this.height);

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += delta * 1000;

      if (particle.age >= particle.life) {
        this.pool.push(particle);
        this.particles[index] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      particle.vy += this.gravity * delta;
      particle.vx *= 0.985;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;

      const remaining = 1 - particle.age / particle.life;
      this.context.globalAlpha = remaining;
      this.context.fillStyle = particle.color;
      this.context.fillRect(
        Math.round(particle.x / 2) * 2,
        Math.round(particle.y / 2) * 2,
        particle.size,
        particle.size,
      );
    }

    this.context.globalAlpha = 1;
    if (this.particles.length > 0) {
      this.frame = requestAnimationFrame(this.animate);
    } else {
      this.frame = null;
      this.context.clearRect(0, 0, this.width, this.height);
    }
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  destroy() {
    window.removeEventListener("resize", this.resize);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    for (const timer of this.celebrationTimers) clearTimeout(timer);
    this.celebrationTimers.clear();
    this.canvas.remove();
    this.particles.length = 0;
    this.pool.length = 0;
  }
}

function random(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}
