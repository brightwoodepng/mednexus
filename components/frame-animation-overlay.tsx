"use client";
import { useEffect, useRef } from "react";

export type FrameAnimId =
  | "frame_fire"
  | "frame_lightning"
  | "frame_legendary_diamond";

interface Props {
  frameId: FrameAnimId;
  onDone: () => void;
}

const DURATION_MS = 3500;

// ─── Audio ────────────────────────────────────────────────────────────────────

function playFireAudio(ac: AudioContext) {
  const dur = DURATION_MS / 1000;

  // White-noise roar
  const bufLen = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;

  const lpf = ac.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(250, ac.currentTime);
  lpf.frequency.linearRampToValueAtTime(900, ac.currentTime + 1.2);
  lpf.frequency.linearRampToValueAtTime(400, ac.currentTime + dur);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.55, ac.currentTime + 0.7);
  gain.gain.linearRampToValueAtTime(0.65, ac.currentTime + 1.5);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + dur);

  src.connect(lpf);
  lpf.connect(gain);
  gain.connect(ac.destination);
  src.start();

  // Deep sub-rumble
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(38, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(55, ac.currentTime + 1.5);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0, ac.currentTime);
  oscGain.gain.linearRampToValueAtTime(0.22, ac.currentTime + 0.4);
  oscGain.gain.linearRampToValueAtTime(0, ac.currentTime + dur);
  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur);
}

function playLightningAudio(ac: AudioContext) {
  const boltTimings = [0.3, 1.2, 2.1]; // seconds from now

  boltTimings.forEach((t) => {
    // Sharp electrical crackle
    const crackleLen = Math.floor(ac.sampleRate * 0.55);
    const cbuf = ac.createBuffer(1, crackleLen, ac.sampleRate);
    const cd = cbuf.getChannelData(0);
    for (let i = 0; i < crackleLen; i++) {
      const env =
        i < 800
          ? i / 800
          : Math.exp(-((i - 800) / (crackleLen * 0.18)));
      cd[i] = (Math.random() * 2 - 1) * env;
    }
    const csrc = ac.createBufferSource();
    csrc.buffer = cbuf;
    const hpf = ac.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 1200;
    const cgain = ac.createGain();
    cgain.gain.value = 1.3;
    csrc.connect(hpf);
    hpf.connect(cgain);
    cgain.connect(ac.destination);
    csrc.start(ac.currentTime + t);

    // Thunder boom
    const boom = ac.createOscillator();
    boom.frequency.setValueAtTime(90, ac.currentTime + t);
    boom.frequency.exponentialRampToValueAtTime(18, ac.currentTime + t + 0.9);
    const bgain = ac.createGain();
    bgain.gain.setValueAtTime(0.9, ac.currentTime + t);
    bgain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.9);
    boom.connect(bgain);
    bgain.connect(ac.destination);
    boom.start(ac.currentTime + t);
    boom.stop(ac.currentTime + t + 0.9);
  });
}

function playDiamondAudio(ac: AudioContext) {
  // Crystalline chime with decaying harmonics
  const freqs = [1046, 2093, 3136, 4186, 6272];
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ac.createGain();
    const delay = i * 0.05;
    const decay = 2.8 - i * 0.4;
    gain.gain.setValueAtTime(0, ac.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.28 / (i + 1), ac.currentTime + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + decay);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + decay);
  });

  // Glass-shimmer noise burst
  const slen = Math.floor(ac.sampleRate * 0.25);
  const sbuf = ac.createBuffer(1, slen, ac.sampleRate);
  const sd = sbuf.getChannelData(0);
  for (let i = 0; i < slen; i++) {
    sd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (slen * 0.25)) * 0.35;
  }
  const ssrc = ac.createBufferSource();
  ssrc.buffer = sbuf;
  const shpf = ac.createBiquadFilter();
  shpf.type = "highpass";
  shpf.frequency.value = 5000;
  ssrc.connect(shpf);
  shpf.connect(ac.destination);
  ssrc.start();
}

// ─── Bolt geometry ────────────────────────────────────────────────────────────

function buildBolt(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  roughness: number,
  depth: number
): [number, number][] {
  if (depth === 0) return [[x1, y1], [x2, y2]];
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * roughness;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * roughness * 0.25;
  return [
    ...buildBolt(x1, y1, mx, my, roughness / 2, depth - 1),
    ...buildBolt(mx, my, x2, y2, roughness / 2, depth - 1).slice(1),
  ];
}

// ─── Fire animation ───────────────────────────────────────────────────────────

interface FP {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  born: number; life: number; // life: 0→1
}

function runFireAnimation(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  start: number,
  setRaf: (id: number) => void
) {
  const particles: FP[] = [];
  let last = start;

  function spawn(now: number): FP {
    return {
      x: Math.random() * W,
      y: H + Math.random() * 60,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -(3.5 + Math.random() * 6),
      size: 22 + Math.random() * 44,
      born: now,
      life: 0,
    };
  }

  function color(life: number): string {
    // life: 0 = newborn (bright), 1 = dying (dark red)
    if (life < 0.25) {
      // white → yellow
      const t = life / 0.25;
      return `rgba(255,${Math.round(255 - t * 55)},${Math.round(200 * (1 - t))},${0.9 - t * 0.1})`;
    } else if (life < 0.6) {
      // yellow → orange
      const t = (life - 0.25) / 0.35;
      return `rgba(255,${Math.round(200 - t * 120)},0,${0.8 - t * 0.15})`;
    } else {
      // orange → dark red → transparent
      const t = (life - 0.6) / 0.4;
      return `rgba(${Math.round(255 - t * 150)},${Math.round(80 - t * 80)},0,${0.65 * (1 - t)})`;
    }
  }

  function frame(now: number) {
    const elapsed = now - start;
    if (elapsed >= DURATION_MS) { ctx.clearRect(0, 0, W, H); return; }
    const dt = Math.min(now - last, 50);
    last = now;

    // Ramp spawn intensity: quick rise, hold, taper
    const intensity =
      elapsed < 400 ? elapsed / 400
      : elapsed > 2600 ? Math.max(0, 1 - (elapsed - 2600) / 900)
      : 1;

    const toSpawn = Math.floor(intensity * 10 * (dt / 16));
    for (let i = 0; i < toSpawn && particles.length < 700; i++) {
      particles.push(spawn(now));
    }

    ctx.clearRect(0, 0, W, H);

    // Bottom glow
    const glow = ctx.createLinearGradient(0, H, 0, H * 0.35);
    glow.addColorStop(0, `rgba(200,30,0,${intensity * 0.55})`);
    glow.addColorStop(0.5, `rgba(140,15,0,${intensity * 0.25})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const maxLife = 1400 + p.size * 22;
      p.life = (now - p.born) / maxLife;
      if (p.life >= 1) { particles.splice(i, 1); continue; }

      p.x += p.vx * dt / 16;
      p.y += p.vy * dt / 16;
      p.vx += (Math.random() - 0.5) * 0.35;
      p.vy += 0.03 * dt / 16; // slight deceleration

      const r = p.size * (1 - p.life * 0.45);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, color(p.life));
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    setRaf(requestAnimationFrame(frame));
  }

  setRaf(requestAnimationFrame(frame));
}

// ─── Lightning animation ──────────────────────────────────────────────────────

function runLightningAnimation(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  start: number,
  setRaf: (id: number) => void
) {
  // Pre-generate three bolts
  const bolts = [300, 1200, 2100].map((ms) => ({
    ms,
    pts: buildBolt(
      W * (0.25 + Math.random() * 0.5), 0,
      W * (0.15 + Math.random() * 0.7), H * (0.55 + Math.random() * 0.35),
      220, 8
    ),
  }));

  function frame(now: number) {
    const elapsed = now - start;
    if (elapsed >= DURATION_MS) { ctx.clearRect(0, 0, W, H); return; }

    ctx.clearRect(0, 0, W, H);

    // Storm darkness envelope
    const stormAlpha =
      elapsed < 250 ? (elapsed / 250) * 0.75
      : elapsed > 2900 ? Math.max(0, 0.75 * (1 - (elapsed - 2900) / 600))
      : 0.75;

    // Cloudy gradient overlay
    const storm = ctx.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.5, W * 0.85);
    storm.addColorStop(0, `rgba(12,18,35,${stormAlpha * 0.75})`);
    storm.addColorStop(0.55, `rgba(6,10,22,${stormAlpha})`);
    storm.addColorStop(1, `rgba(3,5,14,${stormAlpha * 0.9})`);
    ctx.fillStyle = storm;
    ctx.fillRect(0, 0, W, H);

    bolts.forEach(({ ms, pts }) => {
      const age = elapsed - ms;
      if (age < 0 || age > 450) return;

      // Flash envelope: instant on, quick decay
      const flash =
        age < 25 ? age / 25
        : age < 90 ? 1
        : Math.max(0, 1 - (age - 90) / 360);
      if (flash <= 0) return;

      // White flash
      ctx.fillStyle = `rgba(210,235,255,${flash * 0.28})`;
      ctx.fillRect(0, 0, W, H);

      // Draw bolt — outer glow → mid → core
      const layers: [number, string][] = [
        [16, `rgba(100,200,255,${flash * 0.3})`],
        [8, `rgba(180,235,255,${flash * 0.6})`],
        [3, `rgba(240,250,255,${flash * 0.85})`],
        [1.5, `rgba(255,255,255,${flash})`],
      ];

      layers.forEach(([lw, style]) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.stroke();
      });
    });

    setRaf(requestAnimationFrame(frame));
  }

  setRaf(requestAnimationFrame(frame));
}

// ─── Diamond animation ────────────────────────────────────────────────────────

interface DP {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  rot: number; rotV: number;
  color: string;
  born: number; dur: number;
  glint: number;
}

const DIAMOND_COLORS = [
  "255,255,255", "210,245,255", "170,225,255",
  "230,248,255", "195,235,250", "220,240,255",
];

function runDiamondAnimation(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  start: number,
  setRaf: (id: number) => void
) {
  const cx = W / 2, cy = H / 2;

  const particles: DP[] = Array.from({ length: 450 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 10;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 2 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      rotV: (Math.random() - 0.5) * 0.18,
      color: DIAMOND_COLORS[Math.floor(Math.random() * DIAMOND_COLORS.length)],
      born: start + Math.random() * 180,
      dur: 1600 + Math.random() * 1900,
      glint: Math.random() * Math.PI * 2,
    };
  });

  let last = start;

  function frame(now: number) {
    const elapsed = now - start;
    if (elapsed >= DURATION_MS) { ctx.clearRect(0, 0, W, H); return; }
    const dt = Math.min(now - last, 50);
    last = now;

    ctx.clearRect(0, 0, W, H);

    // Radial shimmer at center
    const shimmerAlpha =
      elapsed < 300 ? (elapsed / 300) * 0.18
      : Math.max(0, 0.18 * (1 - (elapsed - 2000) / 1500));
    if (shimmerAlpha > 0) {
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
      sg.addColorStop(0, `rgba(225,248,255,${shimmerAlpha})`);
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    }

    for (const p of particles) {
      if (now < p.born) continue;
      const age = now - p.born;
      const life = age / p.dur;
      if (life >= 1) continue;

      p.x += p.vx * dt / 16;
      p.y += p.vy * dt / 16;
      p.vy += 0.09 * dt / 16; // gravity
      p.rot += p.rotV;

      const glint = 0.45 + 0.55 * Math.sin(p.glint + now * 0.009);
      const alpha = (1 - life) * (0.35 + glint * 0.65);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + Math.PI / 4);

      // Soft glow halo
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2.5);
      halo.addColorStop(0, `rgba(${p.color},${alpha * 0.6})`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.rect(-p.size * 2.5, -p.size * 2.5, p.size * 5, p.size * 5);
      ctx.fill();

      // Sharp diamond core
      ctx.fillStyle = `rgba(${p.color},${alpha})`;
      ctx.beginPath();
      ctx.rect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
      ctx.fill();

      ctx.restore();
    }

    setRaf(requestAnimationFrame(frame));
  }

  setRaf(requestAnimationFrame(frame));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FrameAnimationOverlay({ frameId, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    let rafId = 0;
    let audioCtx: AudioContext | null = null;

    try {
      audioCtx = new AudioContext();
    } catch {
      /* audio blocked — visuals-only fallback */
    }

    const start = performance.now();
    const setRaf = (id: number) => { rafId = id; };

    if (frameId === "frame_fire") {
      if (audioCtx) playFireAudio(audioCtx);
      runFireAnimation(ctx, W, H, start, setRaf);
    } else if (frameId === "frame_lightning") {
      if (audioCtx) playLightningAudio(audioCtx);
      runLightningAnimation(ctx, W, H, start, setRaf);
    } else if (frameId === "frame_legendary_diamond") {
      if (audioCtx) playDiamondAudio(audioCtx);
      runDiamondAnimation(ctx, W, H, start, setRaf);
    }

    const timer = window.setTimeout(() => {
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, W, H);
      audioCtx?.close().catch(() => {});
      onDoneRef.current();
    }, DURATION_MS);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, W, H);
      audioCtx?.close().catch(() => {});
    };
  }, [frameId]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ willChange: "transform", transform: "translateZ(0)" }}
    />
  );
}
