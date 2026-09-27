import { useEffect, useRef, useState, useCallback } from "react";

/**
 * WebSocket hook with light exponential backoff. Errors are logged to the
 * console (never silently swallowed) but do not throw — the reconnect loop
 * is the recovery path.
 */
export function useSocket(pathOrUrl, onMessage) {
    const wsRef = useRef(null);
    const attemptRef = useRef(0);
    const onMessageRef = useRef(onMessage);
    const [connected, setConnected] = useState(false);

    // Keep the latest onMessage without retriggering the connect effect
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connectRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        let timer = null;

        function connect() {
            const base = process.env.REACT_APP_BACKEND_URL || "";
            const wsBase = base.replace(/^http/, "ws");
            const url = pathOrUrl.startsWith("ws")
                ? pathOrUrl
                : `${wsBase}${pathOrUrl}`;

            let ws;
            try {
                ws = new WebSocket(url);
            } catch (err) {
                console.error("[useSocket] failed to open", url, err);
                schedule();
                return;
            }
            wsRef.current = ws;

            ws.onopen = () => {
                attemptRef.current = 0;
                setConnected(true);
            };
            ws.onmessage = (evt) => {
                try {
                    onMessageRef.current?.(JSON.parse(evt.data));
                } catch (err) {
                    console.warn("[useSocket] bad payload", err);
                }
            };
            ws.onclose = (evt) => {
                setConnected(false);
                if (evt.code >= 4000) {
                    console.warn("[useSocket] closed", evt.code, evt.reason);
                }
                if (!cancelled) schedule();
            };
            ws.onerror = (err) => {
                console.debug("[useSocket] error, will reconnect", err);
                try {
                    ws.close();
                } catch (closeErr) {
                    console.debug("[useSocket] close after error failed", closeErr);
                }
            };
        }

        function schedule() {
            const delay = Math.min(4000, 500 * 2 ** attemptRef.current);
            attemptRef.current += 1;
            timer = setTimeout(connect, delay);
        }

        connectRef.current = connect;
        connect();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            try {
                wsRef.current?.close();
            } catch (err) {
                console.debug("[useSocket] cleanup close failed", err);
            }
        };
    }, [pathOrUrl]);

    return { connected };
}
