"use client";

import { useEffect, useRef } from "react";

export default function IotBackgroundCanvas({
  density = 70,      // number of nodes
  maxDist = 140,     // link distance
  speed = 0.35,      // node speed
  pulseRate = 0.55,  // packet speed
}) {
  const ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });

    let w = 0;
    let h = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ---- create nodes ----
    const rand = (a, b) => Math.random() * (b - a) + a;

    const nodes = Array.from({ length: density }).map(() => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-1, 1) * speed,
      vy: rand(-1, 1) * speed,
      r: rand(1.2, 2.4),
      glow: rand(0.12, 0.28),
      phase: rand(0, Math.PI * 2),
    }));

    // packet pulses on links
    const pulses = [];
    const spawnPulse = (ax, ay, bx, by) => {
      pulses.push({
        ax, ay, bx, by,
        t: 0,
        v: pulseRate * rand(0.7, 1.3),
        life: rand(0.6, 1.1),
      });
      if (pulses.length > 140) pulses.shift();
    };

    let t0 = performance.now();

    const draw = (now) => {
      const dt = Math.min(0.032, (now - t0) / 1000);
      t0 = now;

      // background fade
      ctx.clearRect(0, 0, w, h);

      // soft gradient base
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(8, 16, 30, 1)");
      g.addColorStop(0.55, "rgba(6, 12, 22, 1)");
      g.addColorStop(1, "rgba(3, 6, 12, 1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // glow blobs
      const blob = (x, y, r, a) => {
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(0, 255, 255, ${a})`);
        rg.addColorStop(1, "rgba(0, 255, 255, 0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };

      blob(w * 0.18, h * 0.25, Math.min(w, h) * 0.28, 0.10);
      blob(w * 0.85, h * 0.75, Math.min(w, h) * 0.34, 0.08);

      // subtle grid
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      const step = 80;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // move nodes
      for (const n of nodes) {
        n.x += n.vx * (dt * 60);
        n.y += n.vy * (dt * 60);

        // bounce
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;

        n.phase += dt * 0.9;
      }

      // draw links + sometimes spawn pulses
      const maxD2 = maxDist * maxDist;

      ctx.lineWidth = 1;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxD2) continue;

          const d = Math.sqrt(d2);
          const alpha = (1 - d / maxDist) * 0.22;

          // link
          ctx.strokeStyle = `rgba(180, 240, 255, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          // chance to spawn "packet"
          if (Math.random() < 0.0008) spawnPulse(a.x, a.y, b.x, b.y);
        }
      }

      // pulses
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        p.t += p.v * dt;

        if (p.t > p.life) {
          pulses.splice(k, 1);
          continue;
        }

        const tt = p.t / p.life; // 0..1
        const x = p.ax + (p.bx - p.ax) * tt;
        const y = p.ay + (p.by - p.ay) * tt;

        // bright pulse point
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255, ${0.65 * (1 - tt)})`;
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // glow
        const rg = ctx.createRadialGradient(x, y, 0, x, y, 22);
        rg.addColorStop(0, "rgba(0, 255, 255, 0.18)");
        rg.addColorStop(1, "rgba(0, 255, 255, 0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // nodes
      for (const n of nodes) {
        const twinkle = 0.55 + 0.45 * Math.sin(n.phase);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255, ${0.55 * twinkle})`;
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        // outer glow
        const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 18);
        rg.addColorStop(0, `rgba(255,255,255, ${n.glow * twinkle})`);
        rg.addColorStop(1, "rgba(255,255,255, 0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // scanline
      const scanY = (now / 28) % (h + 160) - 80;
      const sg = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      sg.addColorStop(0, "rgba(0,255,255,0)");
      sg.addColorStop(0.5, "rgba(0,255,255,0.07)");
      sg.addColorStop(1, "rgba(0,255,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 40, w, 80);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [density, maxDist, speed, pulseRate]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={ref} className="h-full w-full" />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.04),transparent_55%)]" />
      <div className="absolute inset-0 [box-shadow:inset_0_0_140px_rgba(0,0,0,0.75)]" />
    </div>
  );
}
