import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Terminal as TerminalIcon, Loader2, X } from 'lucide-react';

type SegmentKind = 'command' | 'stdout' | 'stderr' | 'system' | 'exit';
interface Segment {
  kind: SegmentKind;
  text: string;
  exitCode?: number | null;
}

interface Props {
  deploymentId: string;
  /** Whether the container is currently running. When false, the shell is disabled. */
  enabled: boolean;
}

const QUICK_CMDS = [
  { label: 'env', cmd: 'env | sort' },
  { label: 'printenv DB', cmd: 'printenv | grep -E "MYSQL|REDIS|DB_|SITE_|ADMIN" | sort' },
  { label: 'ps', cmd: 'ps -ef' },
  { label: 'df -h', cmd: 'df -h' },
  { label: 'pwd && ls', cmd: 'pwd && ls -la' },
  { label: 'npm run seed', cmd: 'npm run seed' },
  { label: 'npm run migrate', cmd: 'npm run migrate' },
  { label: 'prisma migrate deploy', cmd: 'npx prisma migrate deploy' },
];

export function DebugShell({ deploymentId, enabled }: Props) {
  const [command, setCommand] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState<number>(-1);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open WS exec connection when the tab is active and the container is up.
  useEffect(() => {
    if (!enabled || !deploymentId) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    const wsUrl = (import.meta as any).env?.VITE_WS_URL
      || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(`${wsUrl}?token=${token}&deploymentId=${deploymentId}&mode=exec`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setRunning(false); };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const m = JSON.parse(event.data);
        if (m.type === 'STDOUT') {
          setSegments((s) => appendStream(s, 'stdout', m.message));
        } else if (m.type === 'STDERR') {
          setSegments((s) => appendStream(s, 'stderr', m.message));
        } else if (m.type === 'SYSTEM') {
          setSegments((s) => [...s, { kind: 'system', text: m.message }]);
        } else if (m.type === 'START') {
          // command echo handled client-side already
        } else if (m.type === 'EXIT') {
          setSegments((s) => [...s, { kind: 'exit', text: '', exitCode: m.exitCode }]);
          setRunning(false);
          inputRef.current?.focus();
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, deploymentId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segments, running]);

  const run = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || running || !connected) return;
    wsRef.current?.send(JSON.stringify({ command: trimmed }));
    setSegments((s) => [...s, { kind: 'command', text: trimmed }]);
    setCmdHistory((h) => [...h, trimmed]);
    setCmdHistoryIdx(-1);
    setRunning(true);
    setCommand('');
  };

  const cancel = () => {
    if (!running) return;
    wsRef.current?.send(JSON.stringify({ kind: 'cancel' }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run(command);
    } else if (e.key === 'c' && e.ctrlKey && running) {
      e.preventDefault();
      cancel();
    } else if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
      e.preventDefault();
      const newIdx = cmdHistoryIdx === -1 ? cmdHistory.length - 1 : Math.max(0, cmdHistoryIdx - 1);
      setCmdHistoryIdx(newIdx);
      setCommand(cmdHistory[newIdx]);
    } else if (e.key === 'ArrowDown' && cmdHistoryIdx !== -1) {
      e.preventDefault();
      const newIdx = cmdHistoryIdx + 1;
      if (newIdx >= cmdHistory.length) {
        setCmdHistoryIdx(-1);
        setCommand('');
      } else {
        setCmdHistoryIdx(newIdx);
        setCommand(cmdHistory[newIdx]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-200">Debug Shell</span>
          <span className="text-xs text-slate-500">— runs inside the container, streaming output</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {!enabled && <span className="text-amber-400">Container not running</span>}
          {enabled && connected && <span className="text-emerald-400">● Connected</span>}
          {enabled && !connected && <span className="text-slate-500">○ Connecting…</span>}
          {running && (
            <button onClick={cancel} className="flex items-center gap-1 text-red-400 hover:text-red-300" title="Cancel (Ctrl+C)">
              <X className="h-3 w-3" /> stop
            </button>
          )}
        </div>
      </div>

      {/* Quick command chips */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-slate-700/60 bg-slate-900/40">
        {QUICK_CMDS.map((q) => (
          <button
            key={q.label}
            disabled={!connected || running}
            onClick={() => run(q.cmd)}
            className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={q.cmd}
          >
            {q.label}
          </button>
        ))}
        {segments.length > 0 && (
          <button
            onClick={() => setSegments([])}
            className="text-[11px] px-2 py-0.5 rounded text-slate-500 hover:text-slate-300 ml-auto"
          >clear</button>
        )}
      </div>

      {/* Stream output */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {segments.length === 0 && !running && (
          <div className="text-slate-600">
            <p>Run a command inside the container. Tips:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Use the chips above, or type your own command</li>
              <li>Every command runs through <span className="text-slate-400">sh -c</span> — pipes, &amp;&amp;, redirects all work</li>
              <li>Output streams in real time, including long-running scripts</li>
              <li>↑/↓ to navigate command history · Ctrl+C to cancel</li>
            </ul>
          </div>
        )}
        {segments.map((seg, i) => {
          if (seg.kind === 'command') {
            return <div key={i} className="text-emerald-400"><span className="text-slate-500">$ </span>{seg.text}</div>;
          }
          if (seg.kind === 'stdout') {
            return <pre key={i} className="text-slate-300 whitespace-pre-wrap inline">{seg.text}</pre>;
          }
          if (seg.kind === 'stderr') {
            return <pre key={i} className="text-red-300/80 whitespace-pre-wrap inline">{seg.text}</pre>;
          }
          if (seg.kind === 'system') {
            return <div key={i} className="text-slate-500 italic">{seg.text}</div>;
          }
          if (seg.kind === 'exit') {
            const ok = seg.exitCode === 0;
            return (
              <div key={i} className={`mt-1 mb-2 ${ok ? 'text-slate-500' : 'text-red-400'}`}>
                ─ exit {seg.exitCode ?? '?'} {ok ? '' : '(failed)'}
              </div>
            );
          }
          return null;
        })}
        {running && (
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Running… (Ctrl+C to cancel)</span>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-700 bg-slate-900/80">
        <span className="text-emerald-400 font-mono text-sm select-none">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!connected || running}
          placeholder={!enabled ? 'Container offline' : !connected ? 'Connecting…' : running ? 'Command running… (Ctrl+C to cancel)' : 'Type a command, Enter to run…'}
          className="flex-1 bg-transparent border-none outline-none text-slate-200 font-mono text-sm placeholder:text-slate-600 disabled:opacity-50"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          onClick={() => run(command)}
          disabled={!connected || running || !command.trim()}
          className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
    </div>
  );
}

// Coalesce adjacent stdout/stderr chunks into one segment so the rendered output
// doesn't fragment into thousands of <pre> nodes for chatty commands.
function appendStream(segments: Segment[], kind: 'stdout' | 'stderr', chunk: string): Segment[] {
  const last = segments[segments.length - 1];
  if (last && last.kind === kind) {
    const next = segments.slice(0, -1);
    next.push({ ...last, text: last.text + chunk });
    return next;
  }
  return [...segments, { kind, text: chunk }];
}
