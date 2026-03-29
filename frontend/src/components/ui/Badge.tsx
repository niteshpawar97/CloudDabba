import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-slate-700 text-slate-300': variant === 'default',
          'bg-green-900/50 text-green-400': variant === 'success',
          'bg-amber-900/50 text-amber-400': variant === 'warning',
          'bg-red-900/50 text-red-400': variant === 'danger',
          'bg-blue-900/50 text-blue-400': variant === 'info',
          'bg-purple-900/50 text-purple-400': variant === 'purple',
        }
      )}
    >
      {children}
    </span>
  );
}
