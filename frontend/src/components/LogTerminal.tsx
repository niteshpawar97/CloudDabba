import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { LogLine } from '../types/log';

interface LogTerminalProps {
  lines: LogLine[];
  className?: string;
}

function getLineColor(type: string) {
  switch (type) {
    case 'BUILD': return 'text-blue-400';
    case 'RUNTIME': return 'text-slate-300';
    case 'SYSTEM': return 'text-green-400';
    case 'STATUS': return 'text-amber-400';
    default: return 'text-slate-400';
  }
}

export function LogTerminal({ lines, className }: LogTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className={clsx('relative', className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="log-terminal bg-terminal rounded-lg p-4 font-mono text-sm overflow-auto h-full min-h-[300px]"
      >
        {lines.length === 0 && (
          <div className="text-slate-500 animate-pulse">Waiting for logs...</div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 leading-6">
            <span className="text-slate-600 select-none shrink-0 w-20 text-xs">
              {new Date(line.timestamp).toLocaleTimeString()}
            </span>
            <span className={getLineColor(line.type)}>{line.message}</span>
          </div>
        ))}
      </div>
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
          }}
          className="absolute bottom-4 right-4 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700"
        >
          Follow
        </button>
      )}
    </div>
  );
}
