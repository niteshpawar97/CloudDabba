import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>}
    <input
      ref={ref}
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl text-slate-200 placeholder-slate-500',
        'bg-[#0f1218] border transition-all duration-200',
        'shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]',
        'focus:outline-none focus:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.02),0_0_0_2px_rgba(59,130,246,0.3)]',
        'focus:border-blue-500/40',
        error ? 'border-red-500/50' : 'border-white/[0.06]',
        className
      )}
      {...props}
    />
    {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
  </div>
));
