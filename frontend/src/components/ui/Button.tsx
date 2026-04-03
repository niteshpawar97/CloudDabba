import { ButtonHTMLAttributes, useRef, useCallback } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  glow?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, glow = true, className, children, disabled, ...props }: ButtonProps) {
  const rippleRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (rippleRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const r = rippleRef.current;
      r.style.left = `${e.clientX - rect.left}px`;
      r.style.top = `${e.clientY - rect.top}px`;
      r.style.opacity = '0.25';
      r.style.transform = 'scale(0)';
      r.offsetHeight;
      r.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
      r.style.transform = 'scale(5)';
      r.style.opacity = '0';
    }
    props.onClick?.(e);
  }, [props.onClick]);

  const isDisabled = disabled || loading;

  return (
    <button
      className={clsx(
        // Base
        'relative overflow-hidden rounded-xl font-medium transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed',
        // Neumorphic + variant styles
        {
          // Primary — neon blue glow
          [clsx(
            'bg-blue-600 text-white',
            'shadow-[0_4px_14px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
            !isDisabled && 'hover:shadow-[0_6px_24px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] hover:scale-[1.03]',
            !isDisabled && 'active:scale-[0.97] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]',
          )]: variant === 'primary',

          // Secondary — soft neumorphic
          [clsx(
            'bg-[#1a1f2e] text-slate-200',
            'shadow-[3px_3px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.03)]',
            !isDisabled && 'hover:shadow-[4px_4px_12px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:scale-[1.03]',
            !isDisabled && 'active:scale-[0.97] active:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]',
          )]: variant === 'secondary',

          // Danger — neon red glow
          [clsx(
            'bg-red-600 text-white',
            'shadow-[0_4px_14px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]',
            !isDisabled && 'hover:shadow-[0_6px_24px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] hover:scale-[1.03]',
            !isDisabled && 'active:scale-[0.97] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]',
          )]: variant === 'danger',

          // Ghost
          [clsx(
            'text-slate-400',
            !isDisabled && 'hover:text-white hover:bg-white/[0.06] hover:shadow-[0_0_12px_rgba(255,255,255,0.04)]',
            !isDisabled && 'active:scale-[0.97]',
          )]: variant === 'ghost',

          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2.5 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      disabled={isDisabled}
      {...props}
      onClick={handleClick}
    >
      {/* Ripple */}
      <span
        ref={rippleRef}
        className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-white/40 pointer-events-none"
        style={{ opacity: 0, transform: 'scale(0)' }}
      />

      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </span>
      ) : (
        <span className="relative z-10">{children}</span>
      )}
    </button>
  );
}
