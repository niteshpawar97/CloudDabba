import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { execInContainer, ExecResult } from '../api/deployments';
import { Terminal as TerminalIcon, Loader2 } from 'lucide-react';

interface HistoryEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  ts: number;
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
  { label: 'cat /etc/os-release', cmd: 'cat /etc/os-release' },
  { label: 'pwd && ls', cmd: 'pwd && ls -la' },
];

export function DebugShell({ deploymentId, enabled }: Props) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, running]);

  const run = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || running) return;
    setRunning(true);
    setCmdHistory((h) => [...h, trimmed]);
    setCmdHistoryIdx(-1);
    try {
      const result: ExecResult = await execInContainer(deploymentId, trimmed);
      setHistory((h) => [...h, {
        command: trimmed,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode,
        ts: Date.now(),
      }]);
    } catch (e: any) {
      setHistory((h) => [...h, {
        command: trimmed,
        stdout: '',
        stderr: e?.response?.data?.message || e?.message || 'Request failed',
        exitCode: -1,
        ts: Date.now(),
      }]);
    } finally {
      setRunning(false);
      setCommand('');
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run(command);
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
          <span className="text-xs text-slate-500">— runs inside the deployed container</span>
        </div>
        {!enabled && (
          <span className="text-xs text-amber-400">Container not running</span>
        )}
      </div>

      {/* Quick command chips */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-slate-700/60 bg-slate-900/40">
        {QUICK_CMDS.map((q) => (
          <button
            key={q.label}
            disabled={!enabled || running}
            onClick={() => run(q.cmd)}
            className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={q.cmd}
          >
            {q.label}
          </button>
        ))}
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            className="text-[11px] px-2 py-0.5 rounded text-slate-500 hover:text-slate-300 ml-auto"
          >clear</button>
        )}
      </div>

      {/* History output */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {history.length === 0 && !running && (
          <div className="text-slate-600">
            <p>Run a command inside the container. Tips:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Use the quick chips above, or type your own command</li>
              <li>Each command runs through <span className="text-slate-400">sh -c</span> — pipes, redirects, &amp;&amp; all work</li>
              <li>↑/↓ to navigate command history</li>
              <li>30s timeout per command</li>
            </ul>
          </div>
        )}
        {history.map((h, i) => (
          <div key={i} className="mb-3">
            <div className="text-emerald-400">
              <span className="text-slate-500">$ </span>{h.command}
              {h.exitCode !== null && h.exitCode !== 0 && (
                <span className="text-red-400 ml-2">[exit {h.exitCode}]</span>
              )}
            </div>
            {h.stdout && <pre className="text-slate-300 whitespace-pre-wrap">{h.stdout}</pre>}
            {h.stderr && <pre className="text-red-300/80 whitespace-pre-wrap">{h.stderr}</pre>}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Running…</span>
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
          disabled={!enabled || running}
          placeholder={enabled ? 'Type a command, Enter to run…' : 'Container offline'}
          className="flex-1 bg-transparent border-none outline-none text-slate-200 font-mono text-sm placeholder:text-slate-600 disabled:opacity-50"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          onClick={() => run(command)}
          disabled={!enabled || running || !command.trim()}
          className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
    </div>
  );
}
