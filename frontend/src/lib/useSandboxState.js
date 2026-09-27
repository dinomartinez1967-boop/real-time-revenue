import { useCallback, useEffect, useState } from "react";
import {
    fetchState,
    fetchNetworks,
    fetchNiches,
    fetchHistory,
    llmStatus,
} from "./api";
import { useSocket } from "./useSocket";

/**
 * Owns the full command center state: engine snapshot, network catalog,
 * niche catalog, LLM readiness, and the live WebSocket tick reducer.
 *
 * Extracted from CommandCenter.jsx to keep the page component small.
 */
export function useSandboxState() {
    const [state, setState] = useState(null);
    const [netMeta, setNetMeta] = useState([]);
    const [niches, setNiches] = useState([]);
    const [llm, setLlm] = useState(null);

    // Initial hydration + persisted history merge
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [s, m, n, l, h] = await Promise.all([
                    fetchState(),
                    fetchNetworks(),
                    fetchNiches(),
                    llmStatus(),
                    fetchHistory(180),
                ]);
                if (!alive) return;
                if (h?.series?.length) {
                    const historical = h.series.map((row, i) => ({
                        t: row.tick ?? i,
                        earnings_total:
                            row.totals?.earnings ?? row.earnings_total ?? 0,
                        earnings_delta: row.earnings_delta ?? 0,
                        imp_per_sec: row.imp_per_sec ?? 0,
                        conv_rate: row.conv_rate ?? 0,
                    }));
                    s.series = [...historical, ...(s.series || [])].slice(-180);
                }
                setState(s);
                setNetMeta(m);
                setNiches(n);
                setLlm(l);
            } catch (e) {
                console.error("[sandbox] hydration failed", e);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // Reducer for WS payloads — pulled out so the effect body stays tiny
    const applyMessage = useCallback((msg) => {
        if (msg.type === "snapshot") {
            setState((prev) => ({ ...(prev || {}), ...msg }));
            return;
        }
        if (msg.type !== "tick") return;
        setState((prev) => {
            if (!prev) return prev;
            const nextSeries = [...(prev.series || []), msg.series_point].slice(
                -180,
            );
            const nextMode =
                typeof msg.mode === "string"
                    ? { ...(prev.mode || {}), mode: msg.mode }
                    : prev.mode;
            return {
                ...prev,
                ts: msg.ts,
                tick: (prev.tick || 0) + 1,
                totals: msg.totals,
                networks: msg.networks,
                dropdashin: { ...(prev.dropdashin || {}), ...msg.dropdashin },
                series: nextSeries,
                swarm: msg.swarm ?? prev.swarm,
                mode: nextMode,
            };
        });
    }, []);

    const { connected } = useSocket("/api/ws/analytics", applyMessage);

    const refreshMode = useCallback(async () => {
        try {
            const [s, l] = await Promise.all([fetchState(), llmStatus()]);
            setState((prev) => ({ ...(prev || {}), ...s }));
            setLlm(l);
        } catch (e) {
            console.error("[sandbox] refreshMode failed", e);
        }
    }, []);

    return {
        state,
        setState,
        netMeta,
        niches,
        llm,
        connected,
        refreshMode,
    };
}
