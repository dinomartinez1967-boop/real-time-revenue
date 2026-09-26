import { useEffect, useRef, useState } from "react";

/**
 * Small hook that opens a WebSocket to the backend and passes every JSON
 * message to `onMessage`. Reconnects with light exponential backoff.
 */
export function useSocket(pathOrUrl, onMessage) {
    const wsRef = useRef(null);
    const attemptRef = useRef(0);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let timer = null;

        function connect() {
            const base = process.env.REACT_APP_BACKEND_URL || "";
            const wsBase = base.replace(/^http/, "ws");
            const url = pathOrUrl.startsWith("ws") ? pathOrUrl : `${wsBase}${pathOrUrl}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                attemptRef.current = 0;
                setConnected(true);
            };
            ws.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    onMessage?.(data);
                } catch {
                    /* ignore */
                }
            };
            ws.onclose = () => {
                setConnected(false);
                if (cancelled) return;
                const delay = Math.min(4000, 500 * 2 ** attemptRef.current);
                attemptRef.current += 1;
                timer = setTimeout(connect, delay);
            };
            ws.onerror = () => {
                try {
                    ws.close();
                } catch {
                    /* ignore */
                }
            };
        }

        connect();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            try {
                wsRef.current?.close();
            } catch {
                /* ignore */
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathOrUrl]);

    return { connected };
}
