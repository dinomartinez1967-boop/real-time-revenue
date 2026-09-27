import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Zap, ShieldCheck, ShieldAlert } from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopMetrics from "../components/TopMetrics";
import FeedView from "../components/FeedView";
import SwarmPanel from "../components/SwarmPanel";
import GraduatedPanel from "../components/GraduatedPanel";
import {
    fetchState,
    fetchNetworks,
    fetchNiches,
    fetchHistory,
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
    const [swarmOpen, setSwarmOpen] = useState(false);
    const [gradOpen, setGradOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [s, m, n, l, h] = await Promise.all([
                    fetchState(),
                    fetchNetworks(),
                    fetchNiches(),
                    llmStatus(),
                    fetchHistory(180),
                ]);
                // Merge persisted history in front of the live tail
                if (h?.series?.length) {
                    const historical = h.series.map((row, i) => ({
                        t: row.tick ?? i,
                        earnings_total: row.totals?.earnings ?? row.earnings_total ?? 0,
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
                console.error("hydration failed", e);
            }
        })();
    }, []);

    const { connected } = useSocket("/api/ws/analytics", (msg) => {
        if (msg.type === "snapshot") {
            setState((prev) => ({ ...(prev || {}), ...msg }));
        } else if (msg.type === "tick") {
            setState((prev) => {
                if (!prev) return prev;
                const nextSeries = [...(prev.series || []), msg.series_point].slice(
                    -180,
                );
                return {
                    ...prev,
                    ts: msg.ts,
                    tick: (prev.tick || 0) + 1,
                    totals: msg.totals,
                    networks: msg.networks,
                    dropdashin: { ...(prev.dropdashin || {}), ...msg.dropdashin },
                    series: nextSeries,
                    swarm: msg.swarm ?? prev.swarm,
                    mode:
                        typeof msg.mode === "string"
                            ? { ...(prev.mode || {}), mode: msg.mode }
                            : prev.mode,
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

    async function refreshMode() {
        const [s, l] = await Promise.all([fetchState(), llmStatus()]);
        setState((prev) => ({ ...(prev || {}), ...s }));
        setLlm(l);
    }

    const activeMeta = netMeta.find((n) => n.key === active);
    const activeSnap = state?.networks?.find((n) => n.key === active);
    const mode = state?.mode?.mode || "sandbox";
    const isGrad = mode === "graduated";
    const realLlm = !!llm?.real_enabled;

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
                <header
                    className="col-span-2 flex items-center justify-between px-4 py-2 od-panel od-scanlines"
                    data-testid="header"
                >
                    <div className="flex items-center gap-3">
                        <div className="od-diode" />
                        <h1 className="od-mono text-xs uppercase tracking-[0.35em] od-glow-green">
                            android sandbox // automation framework
                        </h1>
                        <button
                            data-testid="mode-badge"
                            onClick={() => setGradOpen(true)}
                            className="ml-4 flex items-center gap-2 px-2 py-1 border rounded-sm od-mono text-[10px] uppercase tracking-widest transition"
                            style={{
                                borderColor: isGrad ? "#ffb454" : "var(--od-green)",
                                color: isGrad ? "#ffb454" : "var(--od-green)",
                            }}
                            title={state?.mode?.banner}
                        >
                            {isGrad ? (
                                <ShieldAlert size={12} />
                            ) : (
                                <ShieldCheck size={12} />
                            )}
                            {mode}
                        </button>
                        <button
                            data-testid="open-swarm"
                            onClick={() => setSwarmOpen(true)}
                            className="flex items-center gap-2 px-2 py-1 border border-[color:var(--od-cyan)] text-[color:var(--od-cyan)] rounded-sm od-mono text-[10px] uppercase tracking-widest hover:bg-[color:var(--od-cyan)] hover:text-black"
                        >
                            <Zap size={12} /> swarm
                            {state?.swarm?.length ? ` · ${state.swarm.length}` : ""}
                        </button>
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

                <Sidebar
                    networks={state?.networks || []}
                    active={active}
                    onSelect={setActive}
                    niches={niches}
                    niche={state?.niche?.key || ""}
                    onNicheChange={onNicheChange}
                    llmStatus={llm}
                />

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
                            mode={mode}
                            onOpenGraduated={() => setGradOpen(true)}
                        />
                    </div>
                </main>
            </div>

            {swarmOpen && (
                <SwarmPanel
                    agents={state?.swarm || []}
                    networks={state?.networks || []}
                    mode={mode}
                    realLlm={realLlm}
                    onClose={() => setSwarmOpen(false)}
                />
            )}
            {gradOpen && (
                <GraduatedPanel
                    mode={mode}
                    onClose={() => setGradOpen(false)}
                    onChanged={refreshMode}
                />
            )}

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
