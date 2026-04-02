import { useState, useEffect, useRef, useCallback } from 'react';
import { LogLine } from '../types/log';

export function useContainerLogs(deploymentId: string | undefined, enabled = true) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<LogLine[]>([]);
  const rafRef = useRef<number>(0);

  const flush = useCallback(() => {
    if (bufferRef.current.length > 0) {
      const batch = [...bufferRef.current];
      bufferRef.current = [];
      setLines((prev) => [...prev, ...batch]);
    }
    rafRef.current = requestAnimationFrame(flush);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    bufferRef.current = [];
  }, []);

  useEffect(() => {
    if (!deploymentId || !enabled) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(`${wsUrl}?token=${token}&deploymentId=${deploymentId}&mode=container`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const data: LogLine = JSON.parse(event.data);
        bufferRef.current.push(data);
      } catch {}
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    rafRef.current = requestAnimationFrame(flush);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [deploymentId, enabled, flush]);

  return { lines, isConnected, clear };
}
