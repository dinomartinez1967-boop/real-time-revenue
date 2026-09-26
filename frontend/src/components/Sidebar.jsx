import NetIcon from "./NetIcon";
import { fmtInt } from "../lib/format";

export default function Sidebar({
    networks,
    active,
    onSelect,
    niches,
    niche,
    onNicheChange,
    llmStatus,
}) {
    return (
        <aside
            className="od-panel h-full flex flex-col"
            data-testid="sidebar"
            style={{ minWidth: 260 }}
        >
            <div className="px-4 pt-4 pb-3 border-b border-[color:var(--od-border)]">
                <div className="flex items-center gap-2">
                    <div className="od-diode" />
                    <span className="od-glow-green od-mono text-sm font-bold tracking-widest">
                        OPENDROID
                    </span>
                </div>
                <div className="od-label mt-1">
                    sandbox // v2026.08
                </div>
            </div>

            {/* Niche selector */}
            <div className="px-4 py-3 border-b border-[color:var(--od-border)]">
                <div className="od-label mb-2">niche • hybrid motor</div>
                <select
                    data-testid="niche-select"
                    className="w-full bg-[color:var(--od-panel-2)] border border-[color:var(--od-border-hot)] text-[color:var(--od-cyan)] od-mono text-xs px-2 py-2 rounded-sm focus:outline-none focus:border-[color:var(--od-green)]"
                    value={niche}
                    onChange={(e) => onNicheChange(e.target.value)}
                >
                    {niches.map((n) => (
                        <option key={n.key} value={n.key}>
                            {n.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Network list */}
            <div className="flex-1 overflow-y-auto od-scroll py-2">
                <div className="od-label px-4 pb-2">networks // 10</div>
                {networks.map((n) => {
                    const isActive = n.key === active;
                    return (
                        <div
                            key={n.key}
                            data-testid={`nav-${n.key}`}
                            className={`od-nav-item ${isActive ? "active" : ""}`}
                            onClick={() => onSelect(n.key)}
                        >
                            <NetIcon
                                name={n.icon}
                                size={14}
                                className={isActive ? "" : "opacity-70"}
                            />
                            <span className="flex-1 od-mono">{n.name}</span>
                            <span className="od-num text-[10px] text-[color:var(--od-text-dim)]">
                                {fmtInt(n.impressions)}
                            </span>
                            {n.banned && (
                                <span
                                    className="text-[9px] od-mono uppercase"
                                    style={{ color: "var(--od-red)" }}
                                >
                                    ban
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* LLM status */}
            <div className="px-4 py-3 border-t border-[color:var(--od-border)]">
                <div className="od-label mb-2">llm gateway</div>
                <div className="flex items-center justify-between text-xs">
                    <span className="od-mono text-[color:var(--od-text-dim)]">
                        provider
                    </span>
                    <span className="od-mono od-glow-cyan uppercase">
                        {llmStatus?.provider || "sim"}
                    </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] od-mono">
                    <StatusPill label="ollama" ok={llmStatus?.ollama_ready} />
                    <StatusPill label="openai" ok={llmStatus?.openai_ready} />
                    <StatusPill label="claude" ok={llmStatus?.anthropic_ready} />
                    <StatusPill label="groq" ok={llmStatus?.groq_ready} />
                </div>
            </div>
        </aside>
    );
}

function StatusPill({ label, ok }) {
    return (
        <div
            className="flex items-center gap-1.5 px-1.5 py-1 border border-[color:var(--od-border)] rounded-sm"
            title={ok ? "reachable" : "no key / offline"}
        >
            <span
                className={"od-diode " + (ok ? "" : "amber")}
                style={{ width: 5, height: 5 }}
            />
            <span className="text-[color:var(--od-text-dim)] uppercase">
                {label}
            </span>
        </div>
    );
}
