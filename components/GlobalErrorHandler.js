'use client';
import { useEffect } from 'react';

export default function GlobalErrorHandler() {
  useEffect(() => {
    const origConsoleError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => String(a?.message || a || '')).join(' ');
      if (msg.includes('Object is disposed') || msg.includes('DevicePixelContentBoxBinding')) {
        return;
      }
      origConsoleError.apply(console, args);
    };

    const handleError = (event) => {
      const msg = event?.message || event?.error?.message || '';
      if (msg.includes('Object is disposed') || msg.includes('DevicePixelContentBoxBinding')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleRejection = (event) => {
      const msg = event?.reason?.message || String(event?.reason || '');
      if (msg.includes('Object is disposed') || msg.includes('DevicePixelContentBoxBinding')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection, true);
    return () => {
      console.error = origConsoleError;
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection, true);
    };
  }, []);

  return null;
}
