import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import Sidebar from "../components/Sidebar";
import TopMetrics from "../components/TopMetrics";
import FeedView from "../components/FeedView";
import {
    fetchState,
    fetchNetworks,
    fetchNiches,
    setNiche as apiSetNiche,
    llmStatus,
} from "../lib/api";
import { useSocket } from "../lib/useSocket";

export default function CommandCenter() {
    const [state, setState] = useState(null);
    const [netMeta, setNetMeta] = useState([]);
    const [niches, setNiches] = useState([]);
    const [active, setActive] = useState("instagram");
    const [llm, setLlm] = useState(null);

    // Initial hydration
    useEffect(() => {
        (async () => {
            try {
                const [s, m, n, l] = await Promise.all([
                    fetchState(),
                    fetchNetworks(),
                    fetchNiches(),
                    llmStatus(),
                ]);
                setState(s);
                setNetMeta(m);
                setNiches(n);
                setLlm(l);
            } catch (e) {
                console.error("hydration failed", e);
            }
        })();
    }, []);

    // Live analytics via WebSocket
    const { connected } = useSocket("/api/ws/analytics", (msg) => {
        if (msg.type === "snapshot") {
            setState(msg);
        } else if (msg.type === "tick") {
            setState((prev) => {
                if (!prev) return prev;
                const nextSeries = [...(prev.series || []), msg.series_point].slice(
                    -90,
                );
                return {
                    ...prev,
                    ts: msg.ts,
                    tick: (prev.tick || 0) + 1,
                    totals: msg.totals,
                    networks: msg.networks,
                    dropdashin: {
                        ...(prev.dropdashin || {}),
                        ...msg.dropdashin,
                    },
                    series: nextSeries,
                };
            });
        }
    });

    async function onNicheChange(key) {
        await apiSetNiche(key);
        setState((prev) =>
            prev
                ? {
                      ...prev,
                      niche: {
                          key,
                          ...(niches.find((n) => n.key === key) || {}),
                      },
                  }
                : prev,
        );
    }

    const activeMeta = netMeta.find((n) => n.key === active);
    const activeSnap = state?.networks?.find((n) => n.key === active);

    return (
        <div className="min-h-screen p-3 md:p-4" data-testid="command-center">
            <div
                className="grid gap-3 md:gap-4"
                style={{
                    gridTemplateColumns: "260px 1fr",
                    gridTemplateRows: "auto 1fr",
                    height: "calc(100vh - 24px)",
                }}
            >
                {/* Header spans both */}
                <header
                    className="col-span-2 flex items-center justify-between px-4 py-2 od-panel od-scanlines"
                    data-testid="header"
                >
                    <div className="flex items-center gap-3">
                        <div className="od-diode" />
                        <h1 className="od-mono text-xs uppercase tracking-[0.35em] od-glow-green">
                            android sandbox // automation framework
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 od-ticker">
                        <span>
                            ws:{" "}
                            <span
                                className={
                                    connected ? "od-glow-green" : "text-[color:var(--od-red)]"
                                }
                            >
                                {connected ? "live" : "reconnecting…"}
                            </span>
                        </span>
                        <span>
                            niche:{" "}
                            <span className="od-glow-cyan">
                                {state?.niche?.label || "…"}
                            </span>
                        </span>
                        <span>
                            uptime:{" "}
                            <span className="od-glow-cyan">
                                {state?.uptime_s ?? 0}s
                            </span>
                        </span>
                    </div>
                </header>

                {/* Sidebar */}
                <Sidebar
                    networks={state?.networks || []}
                    active={active}
                    onSelect={setActive}
                    niches={niches}
                    niche={state?.niche?.key || ""}
                    onNicheChange={onNicheChange}
                    llmStatus={llm}
                />

                {/* Main column */}
                <main
                    className="flex flex-col gap-3 md:gap-4 min-w-0 min-h-0"
                    data-testid="main"
                >
                    <TopMetrics totals={state?.totals} series={state?.series} />
                    <div className="flex-1 min-h-0">
                        <FeedView
                            network={active}
                            netMeta={activeMeta}
                            snapshotNet={activeSnap}
                            dropdashin={state?.dropdashin}
                        />
                    </div>
                </main>
            </div>

            <Toaster
                theme="dark"
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: "#0a1015",
                        border: "1px solid #204050",
                        color: "#d6f0ea",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 12,
                    },
                }}
            />
        </div>
    );
}
