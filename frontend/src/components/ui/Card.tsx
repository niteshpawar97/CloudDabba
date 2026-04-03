import { useRef, useCallback, useState, type CSSProperties } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  neon?: string;       // neon accent color: 'blue' | 'cyan' | 'purple' | 'green' | 'amber' | 'rose'
  interactive?: boolean; // enable hover tilt + glow
}

const NEON_COLORS: Record<string, { glow: string; border: string }> = {
  blue:   { glow: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.25)' },
  cyan:   { glow: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.25)' },
  purple: { glow: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.25)' },
  green:  { glow: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.25)' },
  amber:  { glow: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.25)' },
  rose:   { glow: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.25)' },
};

export function Card({ children, className, onClick, neon, interactive }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!interactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -6, y: x * 6 });
  }, [interactive]);

  const handleLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  const neonStyle = neon && NEON_COLORS[neon];
  const isInteractive = interactive || !!onClick;

  const style: CSSProperties = {
    // Neumorphic dual shadow
    boxShadow: hovered && isInteractive
      ? [
          '6px 6px 16px rgba(0,0,0,0.5)',
          '-4px -4px 12px rgba(255,255,255,0.03)',
          neonStyle ? `0 0 30px ${neonStyle.glow}` : '',
        ].filter(Boolean).join(', ')
      : [
          '4px 4px 12px rgba(0,0,0,0.4)',
          '-2px -2px 8px rgba(255,255,255,0.02)',
        ].join(', '),
    transform: isInteractive
      ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${hovered ? 'scale(1.02)' : 'scale(1)'}`
      : undefined,
    borderColor: hovered && neonStyle ? neonStyle.border : undefined,
    transition: 'all 0.3s cubic-bezier(0.33, 1, 0.68, 1)',
    willChange: isInteractive ? 'transform, box-shadow' : undefined,
  };

  return (
    <div
      ref={ref}
      className={clsx(
        'bg-[#141820] border border-white/[0.06] rounded-2xl p-6',
        isInteractive && 'cursor-pointer',
        className
      )}
      style={style}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}
