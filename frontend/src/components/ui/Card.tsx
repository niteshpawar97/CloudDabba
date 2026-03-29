import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-slate-800/50 border border-slate-700 rounded-xl p-6',
        onClick && 'cursor-pointer hover:border-slate-600 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
