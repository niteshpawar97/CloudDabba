// Lets non-component code (e.g. the axios interceptor in api/client.ts) show a
// toast without needing React context. ToastProvider subscribes on mount.
type ToastType = 'success' | 'error' | 'info';
type Listener = (type: ToastType, message: string) => void;

let listener: Listener | null = null;

export function subscribeToastBus(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function emitToast(type: ToastType, message: string) {
  listener?.(type, message);
}
