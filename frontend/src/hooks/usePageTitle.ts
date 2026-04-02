import { useEffect } from 'react';

const BASE_TITLE = 'CloudDabba';

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — Deploy Your Apps in Seconds`;
    return () => { document.title = `${BASE_TITLE} — Deploy Your Apps in Seconds`; };
  }, [title]);
}
