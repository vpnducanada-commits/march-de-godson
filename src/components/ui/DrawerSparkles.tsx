import { useEffect, useRef } from 'react';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  speed: number;
  gold: boolean;
  burst?: boolean;
  life?: number;
}

/**
 * Effet visuel d'étincelles animées sur le tiroir latéral.
 * - S'exécute uniquement lorsque le tiroir est ouvert (`active === true` → 0 CPU fermé).
 * - Combine des étoiles 4-branches dorées/bleutées flottantes et une micro-gerbe
 *   d'étincelles au toucher, sans jamais bloquer les clics (`pointer-events: none`).
 */
export function DrawerSparkles({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 320;
    let height = window.innerHeight || 720;

    const resize = () => {
      const parent = canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent?.clientWidth || 320;
      height = Math.max(parent?.scrollHeight || 0, parent?.clientHeight || 0, window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const makeAmbientSpark = (initial = false): Spark => ({
      x: Math.random() * width,
      y: initial ? Math.random() * height : height + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.28,
      vy: -(0.22 + Math.random() * 0.55),
      size: 2.4 + Math.random() * 4.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.035 + Math.random() * 0.045,
      gold: Math.random() < 0.76,
    });

    const sparks: Spark[] = Array.from({ length: 30 }, () => makeAmbientSpark(true));

    // Gerbe initiale à l'ouverture du tiroir (en haut près du logo)
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
      const spd = 0.7 + Math.random() * 1.6;
      sparks.push({
        x: 72 + Math.random() * 80,
        y: 34 + Math.random() * 24,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 3 + Math.random() * 4,
        phase: Math.random() * Math.PI,
        speed: 0.08,
        gold: i % 3 !== 0,
        burst: true,
        life: 1,
      });
    }

    const onPointerDown = (ev: PointerEvent) => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right) return;
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top + parent.scrollTop;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.35;
        const spd = 0.8 + Math.random() * 1.8;
        sparks.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 0.3,
          size: 2.5 + Math.random() * 3.5,
          phase: 0,
          speed: 0.1,
          gold: i % 4 !== 0,
          burst: true,
          life: 1,
        });
      }
    };

    const drawStar = (x: number, y: number, r: number, alpha: number, gold: boolean, rot: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Halo doux autour de l'étincelle
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      if (gold) {
        grad.addColorStop(0, 'rgba(255, 232, 145, 0.95)');
        grad.addColorStop(0.45, 'rgba(245, 184, 46, 0.42)');
        grad.addColorStop(1, 'rgba(245, 184, 46, 0)');
      } else {
        grad.addColorStop(0, 'rgba(191, 219, 254, 0.92)');
        grad.addColorStop(0.45, 'rgba(59, 130, 246, 0.36)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Étoile fine à 4 branches (étincelle)
      const inner = r * 0.24;
      ctx.fillStyle = gold ? '#fff7cc' : '#e0f2fe';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const aOuter = (i * Math.PI) / 2;
        const aInner = aOuter + Math.PI / 4;
        if (i === 0) ctx.moveTo(Math.cos(aOuter) * r, Math.sin(aOuter) * r);
        else ctx.lineTo(Math.cos(aOuter) * r, Math.sin(aOuter) * r);
        ctx.lineTo(Math.cos(aInner) * inner, Math.sin(aInner) * inner);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.phase += s.speed;

        if (s.burst) {
          s.vy += 0.025;
          s.life = (s.life ?? 1) - 0.024;
          if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          drawStar(s.x, s.y, s.size * s.life, s.life * 0.95, s.gold, s.phase * 0.7);
        } else {
          const twinkle = 0.25 + 0.75 * Math.pow((Math.sin(s.phase) + 1) / 2, 1.6);
          if (s.y < -16 || s.x < -16 || s.x > width + 16) {
            sparks[i] = makeAmbientSpark(false);
            continue;
          }
          drawStar(s.x, s.y, s.size * (0.75 + twinkle * 0.4), twinkle * 0.85, s.gold, s.phase * 0.25);
        }
      }
      raf = window.requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    raf = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [active]);

  return <canvas ref={canvasRef} className="drawer__sparkles" aria-hidden="true" />;
}
