import { ShieldAlert, ShieldCheck, Zap } from "lucide-react";

/**
 * Top command-bar header. Renders mode badge + swarm launcher + live status.
 */
export default function CommandHeader({
    mode,
    banner,
    swarmCount,
    connected,
    niche,
    uptime,
    onOpenGraduated,
    onOpenSwarm,
}) {
    const isGrad = mode === "graduated";
    return (
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
                    onClick={onOpenGraduated}
                    className="ml-4 flex items-center gap-2 px-2 py-1 border rounded-sm od-mono text-[10px] uppercase tracking-widest transition"
                    style={{
                        borderColor: isGrad ? "#ffb454" : "var(--od-green)",
                        color: isGrad ? "#ffb454" : "var(--od-green)",
                    }}
                    title={banner}
                >
                    {isGrad ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                    {mode}
                </button>
                <button
                    data-testid="open-swarm"
                    onClick={onOpenSwarm}
                    className="flex items-center gap-2 px-2 py-1 border border-[color:var(--od-cyan)] text-[color:var(--od-cyan)] rounded-sm od-mono text-[10px] uppercase tracking-widest hover:bg-[color:var(--od-cyan)] hover:text-black"
                >
                    <Zap size={12} /> swarm
                    {swarmCount ? ` · ${swarmCount}` : ""}
                </button>
            </div>
            <div className="flex items-center gap-4 od-ticker">
                <span>
                    ws:{" "}
                    <span
                        className={
                            connected
                                ? "od-glow-green"
                                : "text-[color:var(--od-red)]"
                        }
                    >
                        {connected ? "live" : "reconnecting…"}
                    </span>
                </span>
                <span>
                    niche: <span className="od-glow-cyan">{niche || "…"}</span>
                </span>
                <span>
                    uptime: <span className="od-glow-cyan">{uptime ?? 0}s</span>
                </span>
            </div>
        </header>
    );
}
