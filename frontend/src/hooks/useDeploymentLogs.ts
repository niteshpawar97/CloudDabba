import { useState, useEffect, useRef, useCallback } from 'react';
import { LogLine } from '../types/log';

export function useDeploymentLogs(deploymentId: string | undefined) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
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

  useEffect(() => {
    if (!deploymentId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(`${wsUrl}?token=${token}&deploymentId=${deploymentId}`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const data: LogLine = JSON.parse(event.data);
        if (data.type === 'STATUS' && (data.message === 'LIVE' || data.message === 'FAILED' || data.message === 'STOPPED')) {
          setIsComplete(true);
        }
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
  }, [deploymentId, flush]);

  return { lines, isConnected, isComplete };
}
