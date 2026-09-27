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
                        source
                    </span>
                    <span
                        className="od-mono uppercase"
                        style={{
                            color: llmStatus?.real_enabled
                                ? "var(--od-cyan)"
                                : "var(--od-green)",
                        }}
                    >
                        {llmStatus?.real_enabled ? "real" : "sim"}
                    </span>
                </div>
                <div className="mt-2 od-ticker">
                    key:{" "}
                    <span
                        className={
                            llmStatus?.emergent_key_present
                                ? "od-glow-cyan"
                                : "text-[color:var(--od-text-dim)]"
                        }
                    >
                        {llmStatus?.emergent_key_present ? "present" : "absent"}
                    </span>
                </div>
                <div className="od-ticker mt-0.5">
                    mode:{" "}
                    <span
                        style={{
                            color:
                                llmStatus?.mode === "graduated"
                                    ? "#ffb454"
                                    : "var(--od-green)",
                        }}
                    >
                        {llmStatus?.mode || "sandbox"}
                    </span>
                </div>
            </div>
        </aside>
    );
}