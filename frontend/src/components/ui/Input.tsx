import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>}
    <input
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 rounded-lg bg-slate-800 border text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors',
        error ? 'border-red-500' : 'border-slate-600',
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
  </div>
));
