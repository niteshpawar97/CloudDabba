import { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import { LogLine } from '../types/log';
import { ArrowDown, Search, X } from 'lucide-react';

interface LogTerminalProps {
  lines: LogLine[];
  className?: string;
  title?: string;
  loading?: boolean;
}

function getLineColor(type: string) {
  switch (type) {
    case 'BUILD': return 'text-blue-400';
    case 'RUNTIME': return 'text-slate-300';
    case 'SYSTEM': return 'text-green-400';
    case 'STATUS': return 'text-amber-400';
    case 'ERROR': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'BUILD': return 'build';
    case 'RUNTIME': return 'runtime';
    case 'SYSTEM': return 'system';
    case 'STATUS': return 'status';
    case 'ERROR': return 'error';
    default: return '';
  }
}

function getTypeBadgeColor(type: string) {
  switch (type) {
    case 'BUILD': return 'bg-blue-500/20 text-blue-400';
    case 'RUNTIME': return 'bg-slate-500/20 text-slate-400';
    case 'SYSTEM': return 'bg-green-500/20 text-green-400';
    case 'STATUS': return 'bg-amber-500/20 text-amber-400';
    case 'ERROR': return 'bg-red-500/20 text-red-400';
    default: return 'bg-slate-500/20 text-slate-400';
  }
}

export function LogTerminal({ lines, className, title, loading }: LogTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newLogCount, setNewLogCount] = useState(0);
  const prevLineCount = useRef(lines.length);
  const userScrolledRef = useRef(false);

  // Track new lines when not auto-scrolling
  useEffect(() => {
    if (!autoScroll && lines.length > prevLineCount.current) {
      setNewLogCount((c) => c + (lines.length - prevLineCount.current));
    }
    prevLineCount.current = lines.length;
  }, [lines.length, autoScroll]);

  // Smooth auto-scroll like Vercel
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < 60;

    if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
      setNewLogCount(0);
      userScrolledRef.current = false;
    } else if (!isAtBottom && autoScroll) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    }
  }, [autoScroll]);

  const scrollToBottom = useCallback(() => {
    setAutoScroll(true);
    setNewLogCount(0);
    userScrolledRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  // Filter lines by search
  const filteredLines = searchQuery
    ? lines.filter((l) => l.message.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  return (
    <div className={clsx('relative flex flex-col bg-[#0a0a0a] rounded-xl border border-white/[0.06] overflow-hidden', className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-slate-500 font-mono">{title || 'Terminal'}</span>
          {loading && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400 animate-pulse">Streaming...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{lines.length} lines</span>
          <button
            onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
            className={clsx(
              'p-1 rounded transition-colors',
              showSearch ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            )}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#111] border-b border-white/[0.06]">
          <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none font-mono"
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } }}
          />
          {searchQuery && (
            <span className="text-xs text-slate-500">{filteredLines.length} matches</span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-slate-500 hover:text-slate-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto min-h-[300px] p-1 font-mono text-[13px] leading-[1.6] scroll-smooth"
      >
        {lines.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-slate-600">
            No logs available
          </div>
        )}
        {lines.length === 0 && loading && (
          <div className="flex items-center justify-center h-full gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
            <span className="text-slate-500 ml-2 text-sm">Waiting for logs...</span>
          </div>
        )}
        {filteredLines.map((line, i) => (
          <div
            key={i}
            className={clsx(
              'flex items-start gap-0 px-2 py-[1px] hover:bg-white/[0.02] group',
              searchQuery && line.message.toLowerCase().includes(searchQuery.toLowerCase()) && 'bg-amber-500/5'
            )}
          >
            {/* Line number */}
            <span className="w-10 shrink-0 text-right text-slate-700 select-none pr-3 text-xs leading-[1.6]">
              {i + 1}
            </span>
            {/* Timestamp */}
            <span className="w-[72px] shrink-0 text-slate-600 select-none text-xs leading-[1.6]">
              {new Date(line.timestamp).toLocaleTimeString('en-US', { hour12: false })}
            </span>
            {/* Type badge */}
            <span className={clsx('shrink-0 px-1.5 py-0 rounded text-[10px] font-medium uppercase mr-2 leading-[1.6]', getTypeBadgeColor(line.type))}>
              {getTypeLabel(line.type)}
            </span>
            {/* Message */}
            <span className={clsx('flex-1 break-all whitespace-pre-wrap', getLineColor(line.type))}>
              {line.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Scroll to bottom button - Vercel style */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white text-black text-xs font-medium px-4 py-2 rounded-full shadow-lg hover:bg-slate-100 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {newLogCount > 0 ? `${newLogCount} new lines` : 'Scroll to bottom'}
        </button>
      )}
    </div>
  );
}
