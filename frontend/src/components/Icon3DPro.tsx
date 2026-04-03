import { useRef, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { LucideIcon } from 'lucide-react';

interface Icon3DProProps {
  icon: LucideIcon;
  gradient: string;
  shadowColor: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  depth?: number;          // 0-1, controls tilt intensity
  glowIntensity?: number;  // 0-1, controls glow brightness
  hoverStrength?: number;  // 0-1, controls hover scale/lift
  animSpeed?: number;      // gradient animation speed in seconds
  magnetic?: boolean;      // magnetic cursor attraction
  className?: string;
}

const SIZES = {
  sm: { pad: 'p-2.5', icon: 'h-5 w-5', container: '' },
  md: { pad: 'p-3.5', icon: 'h-6 w-6', container: '' },
  lg: { pad: 'p-5', icon: 'h-8 w-8', container: '' },
  xl: { pad: 'p-7', icon: 'h-12 w-12', container: '' },
};

// Spring physics: damped spring towards target
function useSpring(target: number, stiffness = 120, damping = 14) {
  const ref = useRef({ value: 0, velocity: 0 });
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  const prevTime = useRef(0);

  useEffect(() => {
    ref.current.value = 0;
    ref.current.velocity = 0;
  }, []);

  useEffect(() => {
    const tick = (time: number) => {
      if (!prevTime.current) prevTime.current = time;
      const dt = Math.min((time - prevTime.current) / 1000, 0.064);
      prevTime.current = time;

      const spring = ref.current;
      const force = -stiffness * (spring.value - target);
      const dampForce = -damping * spring.velocity;
      spring.velocity += (force + dampForce) * dt;
      spring.value += spring.velocity * dt;

      if (Math.abs(spring.value - target) < 0.01 && Math.abs(spring.velocity) < 0.01) {
        spring.value = target;
        spring.velocity = 0;
        setValue(target);
        return;
      }

      setValue(spring.value);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, stiffness, damping]);

  return value;
}

export function Icon3DPro({
  icon: Icon,
  gradient,
  shadowColor,
  size = 'md',
  depth = 0.6,
  glowIntensity = 0.6,
  hoverStrength = 0.7,
  animSpeed = 4,
  magnetic = false,
  className = '',
}: Icon3DProProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [lightX, setLightX] = useState(50);
  const [lightY, setLightY] = useState(30);

  const springTiltX = useSpring(tiltX, 150, 18);
  const springTiltY = useSpring(tiltY, 150, 18);
  const springScale = useSpring(isPressed ? 0.92 : isHovered ? 1 + hoverStrength * 0.12 : 1, 200, 20);
  const springGlow = useSpring(isHovered ? 1 : 0, 100, 16);
  const springLightX = useSpring(lightX, 80, 14);
  const springLightY = useSpring(lightY, 80, 14);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const maxTilt = 25 * depth;
    setTiltX((y - 0.5) * -maxTilt);
    setTiltY((x - 0.5) * maxTilt);
    setLightX(x * 100);
    setLightY(y * 100);

    // Magnetic cursor effect
    if (magnetic && containerRef.current) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      containerRef.current.style.transform = `translate(${dx * 0.15}px, ${dy * 0.15}px)`;
    }
  }, [depth, magnetic]);

  const handleMouseLeave = useCallback(() => {
    setTiltX(0);
    setTiltY(0);
    setIsHovered(false);
    setLightX(50);
    setLightY(30);
    if (magnetic && containerRef.current) {
      containerRef.current.style.transform = 'translate(0, 0)';
    }
  }, [magnetic]);

  const s = SIZES[size];
  const glowOpacity = glowIntensity * springGlow;
  const shadowSpread = isHovered ? 40 : 24;

  const faceStyle: CSSProperties = {
    transform: `perspective(800px) rotateX(${springTiltX}deg) rotateY(${springTiltY}deg) scale(${springScale})`,
    transformStyle: 'preserve-3d',
    willChange: 'transform',
    boxShadow: [
      // Ambient shadow (adapts to icon color)
      `0 ${8 + springGlow * 8}px ${shadowSpread}px -4px ${shadowColor.replace(/[\d.]+\)$/, `${0.3 + glowOpacity * 0.25})`)}`,
      // Hard shadow
      `0 2px 8px -2px rgba(0, 0, 0, 0.5)`,
      // Top highlight (shifts with light)
      `inset 0 1px 0 rgba(255, 255, 255, ${0.12 + springGlow * 0.08})`,
      // Bottom inner shadow
      `inset 0 -2px 6px rgba(0, 0, 0, 0.25)`,
    ].join(', '),
  };

  // Dynamic light overlay: radial gradient from cursor position
  const lightOverlay: CSSProperties = {
    background: `radial-gradient(circle at ${springLightX}% ${springLightY}%, rgba(255,255,255,${0.15 + springGlow * 0.12}) 0%, transparent 60%)`,
  };

  // Animated gradient background
  const gradientAnim: CSSProperties = {
    backgroundSize: '200% 200%',
    animation: `gradient-shift ${animSpeed}s ease infinite`,
  };

  return (
    <div
      ref={containerRef}
      className={`inline-block ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{ transition: magnetic ? 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1)' : undefined }}
    >
      <div className="relative" style={faceStyle}>
        {/* Glow aura behind icon */}
        <div
          className="absolute -inset-3 rounded-3xl blur-xl transition-opacity duration-500"
          style={{
            background: shadowColor.replace(/[\d.]+\)$/, `${glowOpacity * 0.5})`),
            opacity: springGlow,
          }}
        />

        {/* Main face - gradient + glass */}
        <div
          className={`relative ${s.pad} rounded-2xl bg-gradient-to-br ${gradient} overflow-hidden border border-white/[0.15]`}
          style={gradientAnim}
        >
          {/* Dynamic light reflection */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none z-10"
            style={lightOverlay}
          />

          {/* Static glass overlay */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-white/[0.18] via-transparent to-black/[0.08]" />

          {/* Glass frost layer */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none backdrop-blur-[0.5px]" />

          {/* Icon */}
          <Icon
            className={`${s.icon} text-white relative z-20 drop-shadow-lg`}
            strokeWidth={1.7}
          />
        </div>

        {/* Bottom 3D edge */}
        <div
          className={`absolute -bottom-1.5 left-1 right-1 h-1.5 rounded-b-xl bg-gradient-to-r ${gradient} blur-[0.5px]`}
          style={{ opacity: 0.35 + springGlow * 0.15 }}
        />
      </div>
    </div>
  );
}

// Floating version for Hero section - adds drift + depth layers
interface FloatingIcon3DProps {
  icon: LucideIcon;
  className?: string;
  shadowColor: string;
  delay?: number;
  speed?: number;  // float speed multiplier
  zDepth?: number; // 0=far, 1=near (affects size + blur)
}

export function FloatingIcon3D({
  icon: Icon,
  className = '',
  shadowColor,
  delay = 0,
  speed = 1,
  zDepth = 0.5,
}: FloatingIcon3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [drift, setDrift] = useState({ x: 0, y: 0 });

  // Randomized drift animation
  useEffect(() => {
    let raf: number;
    const startTime = performance.now() + delay * 1000;

    const tick = (time: number) => {
      const t = ((time - startTime) / 1000) * speed;
      setDrift({
        x: Math.sin(t * 0.7) * 6 + Math.sin(t * 1.3) * 3,
        y: Math.cos(t * 0.5) * 10 + Math.sin(t * 0.9) * 4,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delay, speed]);

  const scale = 0.8 + zDepth * 0.4;
  const opacity = 0.6 + zDepth * 0.4;
  const blur = zDepth > 0.5 ? 0 : (0.5 - zDepth) * 2;

  return (
    <div
      ref={ref}
      className={`${className}`}
      style={{
        transform: `translate(${drift.x}px, ${drift.y}px) scale(${scale})`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transition: 'transform 0.1s linear',
        willChange: 'transform',
      }}
    >
      <div
        className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.1] backdrop-blur-md"
        style={{
          boxShadow: [
            `0 12px 40px -8px ${shadowColor}`,
            '0 4px 12px -4px rgba(0, 0, 0, 0.5)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            'inset 0 -1px 4px rgba(0, 0, 0, 0.12)',
          ].join(', '),
        }}
      >
        <Icon className="h-6 w-6" strokeWidth={1.8} />
      </div>
    </div>
  );
}
