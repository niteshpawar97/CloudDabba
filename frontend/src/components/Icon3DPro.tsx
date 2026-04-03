import { useRef, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { LucideIcon } from 'lucide-react';

// ─── Spring Physics Engine ────────────────────────────────────
// Damped spring interpolation — natural, not mechanical
function useSpring(target: number, stiffness = 120, damping = 14) {
  const spring = useRef({ value: 0, velocity: 0 });
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  const prev = useRef(0);

  useEffect(() => {
    const tick = (time: number) => {
      if (!prev.current) prev.current = time;
      const dt = Math.min((time - prev.current) / 1000, 0.064);
      prev.current = time;

      const s = spring.current;
      const force = -stiffness * (s.value - target);
      const damp = -damping * s.velocity;
      s.velocity += (force + damp) * dt;
      s.value += s.velocity * dt;

      if (Math.abs(s.value - target) < 0.005 && Math.abs(s.velocity) < 0.005) {
        s.value = target;
        s.velocity = 0;
        setValue(target);
        return;
      }
      setValue(s.value);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, stiffness, damping]);

  return value;
}

// ─── Types ────────────────────────────────────────────────────
interface Icon3DProProps {
  icon: LucideIcon;
  gradient: string;
  shadowColor: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  depth?: number;            // 0-1: tilt intensity
  glowIntensity?: number;    // 0-1: glow brightness
  hoverStrength?: number;    // 0-1: hover scale/lift
  animSpeed?: number;        // gradient cycle seconds
  magneticStrength?: number; // 0-1: cursor pull strength (0=off)
  lightingIntensity?: number; // 0-1: dynamic light strength
  animDamping?: number;      // spring damping (higher = less bouncy)
  breathe?: boolean;         // idle breathing animation
  className?: string;
}

const SIZES = {
  sm: { pad: 'p-2.5', icon: 'h-5 w-5' },
  md: { pad: 'p-3.5', icon: 'h-6 w-6' },
  lg: { pad: 'p-5', icon: 'h-8 w-8' },
  xl: { pad: 'p-7', icon: 'h-12 w-12' },
};

// ─── Icon3DPro Component ──────────────────────────────────────
export function Icon3DPro({
  icon: Icon,
  gradient,
  shadowColor,
  size = 'md',
  depth = 0.6,
  glowIntensity = 0.6,
  hoverStrength = 0.7,
  animSpeed = 4,
  magneticStrength = 0,
  lightingIntensity = 0.7,
  animDamping = 18,
  breathe = true,
  className = '',
}: Icon3DProProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [lightX, setLightX] = useState(50);
  const [lightY, setLightY] = useState(30);
  const [breathePhase, setBreathePhase] = useState(0);
  const [entryDir, setEntryDir] = useState<'top' | 'bottom' | 'left' | 'right'>('top');

  // Springs — physics-based interpolation
  const stiffness = 160;
  const springTiltX = useSpring(tiltX, stiffness, animDamping);
  const springTiltY = useSpring(tiltY, stiffness, animDamping);
  const springScale = useSpring(
    isPressed ? 0.9 : isHovered ? 1 + hoverStrength * 0.14 : 1,
    220, 22
  );
  const springGlow = useSpring(isHovered ? 1 : 0, 100, 16);
  const springLightX = useSpring(lightX, 90, 14);
  const springLightY = useSpring(lightY, 90, 14);
  const springZ = useSpring(isHovered ? 20 : 0, 140, animDamping);

  // Idle breathing
  useEffect(() => {
    if (!breathe || isHovered) return;
    let raf: number;
    const start = performance.now();
    const tick = (t: number) => {
      setBreathePhase(Math.sin(((t - start) / 1000) * 0.8) * 0.5 + 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [breathe, isHovered]);

  // Direction-aware hover detection
  const detectDirection = useCallback((e: React.MouseEvent, rect: DOMRect): 'top' | 'bottom' | 'left' | 'right' => {
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
    return y > 0 ? 'bottom' : 'top';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;  // 0-1
    const ny = (e.clientY - rect.top) / rect.height;

    const maxTilt = 28 * depth;
    setTiltX((ny - 0.5) * -maxTilt);
    setTiltY((nx - 0.5) * maxTilt);
    setLightX(nx * 100);
    setLightY(ny * 100);

    // Magnetic pull — distance-based falloff
    if (magneticStrength > 0 && containerRef.current) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.max(rect.width, rect.height);
      const falloff = Math.max(0, 1 - dist / maxDist);
      const pull = magneticStrength * 0.2 * falloff;
      containerRef.current.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
    }
  }, [depth, magneticStrength]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setEntryDir(detectDirection(e, rect));
    setIsHovered(true);
  }, [detectDirection]);

  const handleMouseLeave = useCallback(() => {
    setTiltX(0);
    setTiltY(0);
    setIsHovered(false);
    setIsPressed(false);
    setLightX(50);
    setLightY(30);
    if (magneticStrength > 0 && containerRef.current) {
      containerRef.current.style.transform = 'translate(0, 0)';
    }
  }, [magneticStrength]);

  // Ripple on click
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rippleRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = rippleRef.current;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.opacity = '0.3';
    ripple.style.transform = 'scale(0)';
    ripple.offsetHeight; // force reflow
    ripple.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
    ripple.style.transform = 'scale(4)';
    ripple.style.opacity = '0';
  }, []);

  const s = SIZES[size];
  const glowAmt = glowIntensity * springGlow;
  const breatheScale = breathe && !isHovered ? 1 + breathePhase * 0.015 : 1;
  const breatheGlow = breathe && !isHovered ? breathePhase * 0.15 : 0;

  // Direction-aware initial tilt offset
  const dirOffset = { top: [-3, 0], bottom: [3, 0], left: [0, -3], right: [0, 3] }[entryDir];

  const totalTiltX = springTiltX + (isHovered ? dirOffset[0] * (1 - springGlow) : 0);
  const totalTiltY = springTiltY + (isHovered ? dirOffset[1] * (1 - springGlow) : 0);

  // Shadow layers: ambient (color) + directional (based on tilt)
  const shadowOffsetX = -springTiltY * 0.4;
  const shadowOffsetY = springTiltX * 0.4 + 4;
  const ambientOpacity = 0.25 + glowAmt * 0.3;
  const dirShadowOpacity = 0.15 + glowAmt * 0.1;

  const faceStyle: CSSProperties = {
    transform: [
      `perspective(800px)`,
      `rotateX(${totalTiltX}deg)`,
      `rotateY(${totalTiltY}deg)`,
      `translateZ(${springZ}px)`,
      `scale(${springScale * breatheScale})`,
    ].join(' '),
    transformStyle: 'preserve-3d',
    willChange: 'transform',
    boxShadow: [
      // Ambient glow (color-matched, grows on hover)
      `0 ${8 + glowAmt * 12}px ${24 + glowAmt * 20}px -4px ${shadowColor.replace(/[\d.]+\)$/, `${ambientOpacity})`)}`,
      // Directional shadow (shifts with tilt)
      `${shadowOffsetX}px ${shadowOffsetY}px 12px -4px rgba(0,0,0,${dirShadowOpacity})`,
      // Inner highlights
      `inset 0 1px 0 rgba(255,255,255,${0.12 + glowAmt * 0.1})`,
      `inset 0 -2px 6px rgba(0,0,0,0.2)`,
    ].join(', '),
  };

  // Dynamic lighting: radial gradient follows cursor + ambient
  const litIntensity = lightingIntensity;
  const lightOverlay: CSSProperties = {
    background: [
      // Cursor-following spotlight
      `radial-gradient(circle at ${springLightX}% ${springLightY}%, rgba(255,255,255,${(0.1 + glowAmt * 0.15) * litIntensity}) 0%, transparent 55%)`,
      // Ambient top-left light (always present)
      `linear-gradient(135deg, rgba(255,255,255,${(0.06 + breatheGlow * 0.04) * litIntensity}) 0%, transparent 50%)`,
    ].join(', '),
  };

  return (
    <div
      ref={containerRef}
      className={`inline-block ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onClick={handleClick}
      style={{
        transition: magneticStrength > 0 ? 'transform 0.4s cubic-bezier(0.33, 1, 0.68, 1)' : undefined,
      }}
    >
      <div className="relative" style={faceStyle}>
        {/* Glow aura */}
        <div
          className="absolute -inset-4 rounded-3xl blur-2xl pointer-events-none"
          style={{
            background: shadowColor.replace(/[\d.]+\)$/, `${(glowAmt * 0.45 + breatheGlow * 0.1).toFixed(2)})`),
            opacity: Math.max(springGlow, breatheGlow * 0.5),
            transition: 'opacity 0.3s',
          }}
        />

        {/* Main face */}
        <div
          className={`relative ${s.pad} rounded-2xl bg-gradient-to-br ${gradient} overflow-hidden border border-white/[0.15]`}
          style={{ backgroundSize: '200% 200%', animation: `gradient-shift ${animSpeed}s ease infinite` }}
        >
          {/* Dynamic light overlay */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none z-10" style={lightOverlay} />

          {/* Glass refraction */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-white/[0.16] via-transparent to-black/[0.08]" />

          {/* Ripple layer */}
          <div
            ref={rippleRef}
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/40 pointer-events-none z-30"
            style={{ opacity: 0, transform: 'scale(0)' }}
          />

          {/* Icon */}
          <Icon className={`${s.icon} text-white relative z-20 drop-shadow-lg`} strokeWidth={1.7} />
        </div>

        {/* 3D bottom edge */}
        <div
          className={`absolute -bottom-1.5 left-1 right-1 h-1.5 rounded-b-xl bg-gradient-to-r ${gradient}`}
          style={{
            opacity: 0.3 + glowAmt * 0.2,
            filter: 'blur(0.5px)',
            transform: `translateX(${shadowOffsetX * 0.3}px)`,
          }}
        />
      </div>
    </div>
  );
}

// ─── FloatingIcon3D ─────────────────────────────────────────────
// Hero floating icons with organic drift + z-depth parallax
interface FloatingIcon3DProps {
  icon: LucideIcon;
  className?: string;
  shadowColor: string;
  delay?: number;
  speed?: number;
  zDepth?: number;
}

export function FloatingIcon3D({
  icon: Icon,
  className = '',
  shadowColor,
  delay = 0,
  speed = 1,
  zDepth = 0.5,
}: FloatingIcon3DProps) {
  const [drift, setDrift] = useState({ x: 0, y: 0, rotate: 0 });

  useEffect(() => {
    let raf: number;
    const offset = delay * 1000;

    const tick = (time: number) => {
      const t = ((time + offset) / 1000) * speed;
      // Compose multiple sin/cos for organic movement
      setDrift({
        x: Math.sin(t * 0.7) * 6 + Math.sin(t * 1.3 + 0.5) * 3,
        y: Math.cos(t * 0.5) * 10 + Math.sin(t * 0.9 + 1.2) * 4,
        rotate: Math.sin(t * 0.4) * 3,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delay, speed]);

  const scale = 0.8 + zDepth * 0.4;
  const opacity = 0.55 + zDepth * 0.45;
  const blurAmt = zDepth > 0.5 ? 0 : (0.5 - zDepth) * 2;

  return (
    <div
      className={className}
      style={{
        transform: `translate(${drift.x}px, ${drift.y}px) scale(${scale}) rotate(${drift.rotate}deg)`,
        opacity,
        filter: blurAmt > 0 ? `blur(${blurAmt}px)` : undefined,
        willChange: 'transform, opacity',
      }}
    >
      <div
        className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.1] backdrop-blur-md"
        style={{
          boxShadow: [
            `0 12px 40px -8px ${shadowColor}`,
            '0 4px 12px -4px rgba(0,0,0,0.5)',
            'inset 0 1px 0 rgba(255,255,255,0.15)',
            'inset 0 -1px 3px rgba(0,0,0,0.12)',
          ].join(', '),
        }}
      >
        <Icon className="h-6 w-6" strokeWidth={1.8} />
      </div>
    </div>
  );
}
