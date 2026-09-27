import { useCallback, useState } from "react";
import { Toaster } from "sonner";
import Sidebar from "../components/Sidebar";
import TopMetrics from "../components/TopMetrics";
import FeedView from "../components/FeedView";
import SwarmPanel from "../components/SwarmPanel";
import GraduatedPanel from "../components/GraduatedPanel";
import CommandHeader from "../components/CommandHeader";
import { setNiche as apiSetNiche } from "../lib/api";
import { useSandboxState } from "../lib/useSandboxState";

const TOASTER_STYLE = {
    background: "#0a1015",
    border: "1px solid #204050",
    color: "#d6f0ea",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 12,
};

export default function CommandCenter() {
    const { state, setState, netMeta, niches, llm, connected, refreshMode } =
        useSandboxState();
    const [active, setActive] = useState("instagram");
    const [swarmOpen, setSwarmOpen] = useState(false);
    const [gradOpen, setGradOpen] = useState(false);

    const onNicheChange = useCallback(
        async (key) => {
            try {
                await apiSetNiche(key);
            } catch (err) {
                console.error("[cc] niche change failed", err);
                return;
            }
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
        },
        [niches, setState],
    );

    const activeMeta = netMeta.find((n) => n.key === active);
    const activeSnap = state?.networks?.find((n) => n.key === active);
    const mode = state?.mode?.mode || "sandbox";
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
                <CommandHeader
                    mode={mode}
                    banner={state?.mode?.banner}
                    swarmCount={state?.swarm?.length}
                    connected={connected}
                    niche={state?.niche?.label}
                    uptime={state?.uptime_s}
                    onOpenGraduated={() => setGradOpen(true)}
                    onOpenSwarm={() => setSwarmOpen(true)}
                />

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
                toastOptions={{ style: TOASTER_STYLE }}
            />
        </div>
    );
}
