"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

// Re-exported so callers can invoke audio synchronously inside onClick,
// before any async state setter — keeping within the browser's gesture window.
export { playFireAudio, playLightningAudio, playDiamondAudio };

export type FrameAnimId =
  | "frame_fire"
  | "frame_lightning"
  | "frame_legendary_diamond";

interface Props {
  frameId: FrameAnimId;
  onDone: () => void;
}

// ─── Audio (AudioContext synthesis, called on mount — still within the
//     gesture propagation window from the tap) ───────────────────────────────

function playFireAudio() {
  try {
    const ac = new AudioContext();
    // resume() returns a Promise — catch async block separately
    ac.resume().catch((e) => console.error("Audio blocked:", e));
    const dur = 3.5;
    const bufLen = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const lpf = ac.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.setValueAtTime(200, ac.currentTime);
    lpf.frequency.linearRampToValueAtTime(850, ac.currentTime + 1.2);
    lpf.frequency.linearRampToValueAtTime(380, ac.currentTime + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.65, ac.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0.75, ac.currentTime + 1.5);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + dur);
    src.connect(lpf); lpf.connect(gain); gain.connect(ac.destination);
    src.start();
    const osc = ac.createOscillator();
    osc.frequency.value = 40;
    const og = ac.createGain();
    og.gain.setValueAtTime(0.35, ac.currentTime);
    og.gain.linearRampToValueAtTime(0, ac.currentTime + dur);
    osc.connect(og); og.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
    setTimeout(() => ac.close().catch(() => {}), (dur + 0.3) * 1000);
  } catch (e) { console.error("Audio blocked:", e); }
}

function playLightningAudio() {
  try {
    const ac = new AudioContext();
    ac.resume().catch((e) => console.error("Audio blocked:", e));
    const dur = 3.5;
    const crackAt = [0.5, 1.2, 2.0];
    crackAt.forEach((t) => {
      const bufLen = Math.floor(ac.sampleRate * 0.25);
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hpf = ac.createBiquadFilter();
      hpf.type = "highpass"; hpf.frequency.value = 4000;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.8, ac.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.25);
      src.connect(hpf); hpf.connect(gain); gain.connect(ac.destination);
      src.start(ac.currentTime + t);
      // Thunder boom
      const boom = ac.createOscillator();
      boom.frequency.setValueAtTime(80, ac.currentTime + t + 0.05);
      boom.frequency.linearRampToValueAtTime(30, ac.currentTime + t + 0.8);
      const bg = ac.createGain();
      bg.gain.setValueAtTime(0.5, ac.currentTime + t + 0.05);
      bg.gain.linearRampToValueAtTime(0, ac.currentTime + t + 0.8);
      boom.connect(bg); bg.connect(ac.destination);
      boom.start(ac.currentTime + t + 0.05);
      boom.stop(ac.currentTime + t + 0.8);
    });
    setTimeout(() => ac.close().catch(() => {}), (dur + 0.3) * 1000);
  } catch (e) { console.error("Audio blocked:", e); }
}

function playDiamondAudio() {
  try {
    const ac = new AudioContext();
    ac.resume().catch((e) => console.error("Audio blocked:", e));
    const dur = 3.5;
    const freqs = [1046, 1568, 2093, 3136, 6272];
    freqs.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = "sine"; osc.frequency.value = f;
      const gain = ac.createGain();
      const t0 = ac.currentTime + i * 0.07;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25 - i * 0.04, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + 1.3);
    });
    // shimmer noise
    const bufLen = Math.floor(ac.sampleRate * 0.5);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const hpf = ac.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0.3, ac.currentTime);
    sg.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
    src.connect(hpf); hpf.connect(sg); sg.connect(ac.destination);
    src.start();
    setTimeout(() => ac.close().catch(() => {}), (dur + 0.3) * 1000);
  } catch (e) { console.error("Audio blocked:", e); }
}

// ─── CSS keyframes injected once ─────────────────────────────────────────────

const CSS = `
@keyframes mn-fire-rise {
  0%   { transform: scaleX(1)   scaleY(0.05) translateY(0);    opacity: 0; }
  8%   { opacity: 1; }
  40%  { transform: scaleX(1.25) scaleY(1)   translateY(-5%);  opacity: 0.95; }
  75%  { transform: scaleX(1.5)  scaleY(1.3) translateY(-15%); opacity: 0.85; }
  100% { transform: scaleX(1.7)  scaleY(1.5) translateY(-25%); opacity: 0; }
}
@keyframes mn-fire-glow {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 0.85; }
}
@keyframes mn-lightning-bg {
  0%      { background-color: rgba(0,0,0,0.75); }
  /* bolt 1 at 500ms / 3500ms ≈ 14.3% */
  13%     { background-color: rgba(0,0,0,0.75); }
  14.3%   { background-color: rgba(200,240,255,0.92); }
  16%     { background-color: rgba(0,0,0,0.75); }
  /* bolt 2 at 1200ms / 3500ms ≈ 34.3% */
  33%     { background-color: rgba(0,0,0,0.75); }
  34.3%   { background-color: rgba(200,240,255,0.92); }
  36%     { background-color: rgba(0,0,0,0.75); }
  /* bolt 3 at 2000ms / 3500ms ≈ 57.1% */
  56%     { background-color: rgba(0,0,0,0.75); }
  57.1%   { background-color: rgba(200,240,255,0.92); }
  59%     { background-color: rgba(0,0,0,0.75); }
  100%    { background-color: rgba(0,0,0,0); }
}
@keyframes mn-diamond-burst {
  0%   { transform: translate(-50%,-50%) rotate(45deg) scale(0);   opacity: 1; }
  25%  { opacity: 1; }
  60%  { opacity: 0.7; }
  100% { transform: translate(
           calc(-50% + var(--dx)),
           calc(-50% + var(--dy))
         ) rotate(45deg) scale(var(--sc));
         opacity: 0;
  }
}
`;

let cssInjected = false;
function ensureCSS() {
  if (cssInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

// ─── Diamond data ─────────────────────────────────────────────────────────────

interface DiamondDatum {
  id: number;
  dx: string; dy: string; sc: number;
  size: number; delay: number; dur: number;
  top: string; left: string;
}

function makeDiamonds(): DiamondDatum[] {
  return Array.from({ length: 50 }, (_, i) => {
    const angle = (i / 50) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
    const dist = 180 + Math.random() * 280;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist + 120; // bias downward (gravity feel)
    return {
      id: i,
      dx: `${dx.toFixed(1)}px`,
      dy: `${dy.toFixed(1)}px`,
      sc: 0.3 + Math.random() * 0.9,
      size: 10 + Math.floor(Math.random() * 14),
      delay: Math.random() * 0.3,
      dur: 1.8 + Math.random() * 1.0,
      top: "50%",
      left: "50%",
    };
  });
}

// ─── Sub-animations ───────────────────────────────────────────────────────────

function FireAnim() {
  return (
    <>
      {/* red/amber ground glow */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "60%",
          background:
            "radial-gradient(ellipse at bottom, rgba(220,38,38,0.55) 0%, rgba(249,115,22,0.3) 40%, transparent 75%)",
          animation: "mn-fire-glow 0.6s ease-in-out infinite",
        }}
      />
      {/* main fire pillar */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: "-20%", right: "-20%",
          height: "90%",
          transformOrigin: "bottom center",
          background:
            "radial-gradient(ellipse at bottom, #dc2626 0%, #f97316 30%, #fbbf24 55%, transparent 80%)",
          animation: `mn-fire-rise 3.5s ease-out forwards`,
        }}
      />
      {/* second, offset pillar for volume */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: "-30%", right: "-30%",
          height: "70%",
          transformOrigin: "bottom center",
          background:
            "radial-gradient(ellipse at bottom, rgba(185,28,28,0.8) 0%, rgba(234,88,12,0.5) 40%, transparent 75%)",
          animation: `mn-fire-rise 3.5s ease-out 0.15s forwards`,
          opacity: 0,
        }}
      />
    </>
  );
}

function LightningAnim() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        animation: `mn-lightning-bg 3.5s linear forwards`,
      }}
    />
  );
}

function DiamondAnim({ diamonds }: { diamonds: DiamondDatum[] }) {
  return (
    <>
      {diamonds.map((d) => (
        <div
          key={d.id}
          style={{
            position: "absolute",
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            background: "white",
            boxShadow: "0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(180,220,255,0.6)",
            animationName: "mn-diamond-burst",
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
            animationTimingFunction: "cubic-bezier(0.2,0.8,0.4,1)",
            animationFillMode: "forwards",
            // CSS custom properties for per-diamond burst direction
            ["--dx" as string]: d.dx,
            ["--dy" as string]: d.dy,
            ["--sc" as string]: String(d.sc),
          }}
        />
      ))}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FrameAnimationOverlay({ frameId, onDone }: Props) {
  const [mounted, setMounted] = useState(false);
  const diamonds = useMemo(() => makeDiamonds(), []);

  useEffect(() => {
    ensureCSS();
    setMounted(true);
    // Audio is intentionally NOT called here — it must be invoked synchronously
    // inside the onClick handler (before setActiveFrameAnim) to stay within the
    // browser's user-gesture window. Calling it from useEffect puts it outside
    // that window and causes autoplay blocking.
    const timer = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        // Inline zIndex beats any Tailwind JIT class that may be stripped
        zIndex: 99999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {frameId === "frame_fire" && <FireAnim />}
      {frameId === "frame_lightning" && <LightningAnim />}
      {frameId === "frame_legendary_diamond" && <DiamondAnim diamonds={diamonds} />}
    </div>,
    document.body
  );
}
