import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Plus, Zap, Trophy, Loader2 } from "lucide-react";
import { spawnAgent, stopAgent, stopAllAgents } from "../lib/api";
import { fmtInt } from "../lib/format";

const PROVIDERS = [
    { key: "openai", label: "OpenAI GPT-5.4" },
    { key: "anthropic", label: "Claude Sonnet 4.6" },
    { key: "gemini", label: "Gemini 3.1 Pro" },
];

const TONES = [
    "punchy contrarian",
    "receipt-driven case study",
    "vulnerable founder story",
    "data-heavy analyst",
    "energetic hype",
    "cold spreadsheet",
];

export default function SwarmPanel({
    agents,
    networks,
    mode,
    realLlm,
    onClose,
}) {
    const [name, setName] = useState("");
    const [playbook, setPlaybook] = useState("");
    const [tone, setTone] = useState(TONES[0]);
    const [provider, setProvider] = useState("openai");
    const [cadence, setCadence] = useState(12);
    const [targets, setTargets] = useState(new Set(["instagram", "tiktok"]));
    const [busy, setBusy] = useState(false);

    const sorted = useMemo(
        () => [...(agents || [])].sort((a, b) => b.total_earnings - a.total_earnings),
        [agents],
    );

    function toggleTarget(k) {
        const next = new Set(targets);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        setTargets(next);
    }

    async function onSpawn() {
        if (!name.trim() || !playbook.trim() || targets.size === 0) {
            toast.error("name, playbook and ≥1 network required");
            return;
        }
        setBusy(true);
        try {
            const a = await spawnAgent({
                name: name.trim(),
                playbook: playbook.trim(),
                target_networks: [...targets],
                tone,
                provider,
                cadence_s: Number(cadence),
            });
            toast.success(`agent ${a.name} spawned`);
            setName("");
            setPlaybook("");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "spawn failed");
        } finally {
            setBusy(false);
        }
    }

    async function onStop(id) {
        await stopAgent(id);
        toast.message("agent stopped");
    }

    async function onStopAll() {
        await stopAllAgents();
        toast.message("swarm halted");
    }

    return (
        <div
            className="fixed inset-0 z-40 flex items-stretch justify-end"
            data-testid="swarm-panel"
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <aside
                className="relative w-full max-w-xl od-panel od-panel-hot flex flex-col"
                style={{ borderLeft: "1px solid var(--od-border-hot)" }}
            >
                <div className="px-4 py-3 border-b border-[color:var(--od-border)] flex items-center gap-3">
                    <Zap size={16} className="od-glow-cyan" />
                    <div className="flex-1">
                        <div className="od-mono text-sm od-glow-green">
                            multi-agent swarm
                        </div>
                        <div className="od-label mt-0.5">
                            competitive playbooks on the same feed
                        </div>
                    </div>
                    <div
                        className="od-mono text-[10px] px-2 py-1 border border-[color:var(--od-border-hot)] rounded-sm uppercase"
                        style={{
                            color: mode === "graduated" ? "#ffb454" : "var(--od-green)",
                        }}
                    >
                        mode: {mode}
                    </div>
                    <button
                        data-testid="close-swarm"
                        className="text-[color:var(--od-text-dim)] hover:text-[color:var(--od-red)]"
                        onClick={onClose}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Spawn form */}
                <div className="p-4 border-b border-[color:var(--od-border)] space-y-3">
                    <div className="od-label">spawn agent</div>

                    <div className="grid grid-cols-2 gap-2">
                        <input
                            data-testid="agent-name"
                            className="bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm focus:outline-none focus:border-[color:var(--od-green)]"
                            placeholder="agent name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <input
                            data-testid="agent-cadence"
                            type="number"
                            min="3"
                            max="300"
                            className="bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm focus:outline-none focus:border-[color:var(--od-green)]"
                            placeholder="cadence (s)"
                            value={cadence}
                            onChange={(e) => setCadence(e.target.value)}
                        />
                    </div>

                    <textarea
                        data-testid="agent-playbook"
                        rows={2}
                        placeholder="playbook (one sentence brief)"
                        className="w-full bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm focus:outline-none focus:border-[color:var(--od-green)] resize-none"
                        value={playbook}
                        onChange={(e) => setPlaybook(e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <select
                            data-testid="agent-tone"
                            className="bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm"
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                        >
                            {TONES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <select
                            data-testid="agent-provider"
                            className="bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            title={
                                realLlm
                                    ? "real LLM brain"
                                    : "sandbox / real-llm off — provider preselected, sim will be used until graduated + armed"
                            }
                        >
                            {PROVIDERS.map((p) => (
                                <option key={p.key} value={p.key}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="od-label mb-1.5">target networks</div>
                        <div className="flex flex-wrap gap-1.5">
                            {(networks || []).map((n) => {
                                const on = targets.has(n.key);
                                return (
                                    <button
                                        key={n.key}
                                        data-testid={`target-${n.key}`}
                                        onClick={() => toggleTarget(n.key)}
                                        className={`px-2 py-1 od-mono text-[10px] border rounded-sm uppercase transition ${
                                            on
                                                ? "border-[color:var(--od-green)] text-[color:var(--od-green)] bg-[rgba(0,255,102,0.06)]"
                                                : "border-[color:var(--od-border)] text-[color:var(--od-text-dim)] hover:border-[color:var(--od-border-hot)]"
                                        }`}
                                    >
                                        {n.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            data-testid="spawn-btn"
                            onClick={onSpawn}
                            disabled={busy}
                            className="flex-1 od-mono uppercase text-xs tracking-widest py-2 border border-[color:var(--od-green)] text-[color:var(--od-green)] hover:bg-[color:var(--od-green)] hover:text-black disabled:opacity-40 rounded-sm flex items-center justify-center gap-2"
                        >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            spawn
                        </button>
                        <button
                            data-testid="stop-all-btn"
                            onClick={onStopAll}
                            className="od-mono uppercase text-xs tracking-widest px-3 py-2 border border-[color:var(--od-red)] text-[color:var(--od-red)] hover:bg-[color:var(--od-red)] hover:text-black rounded-sm"
                        >
                            halt all
                        </button>
                    </div>
                </div>

                {/* Leaderboard */}
                <div className="flex-1 overflow-y-auto od-scroll p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Trophy size={14} className="od-glow-green" />
                        <div className="od-label">leaderboard // {sorted.length} agents</div>
                    </div>
                    {sorted.length === 0 && (
                        <div className="od-ticker">
                            no agents running — spawn a few and let them compete
                        </div>
                    )}
                    <ul className="space-y-2">
                        {sorted.map((a, i) => (
                            <li
                                key={a.id}
                                className="od-panel p-3 flex flex-col gap-1"
                                data-testid={`agent-row-${a.id}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="od-glow-green od-num text-[10px]">
                                        #{i + 1}
                                    </span>
                                    <span className="od-mono text-sm truncate flex-1">
                                        {a.name}
                                    </span>
                                    <span
                                        className={`od-mono text-[9px] uppercase px-1.5 py-0.5 border rounded-sm ${
                                            a.last_source === "real"
                                                ? "border-[color:var(--od-cyan)] text-[color:var(--od-cyan)]"
                                                : "border-[color:var(--od-border-hot)] text-[color:var(--od-text-dim)]"
                                        }`}
                                    >
                                        {a.last_source === "real"
                                            ? `${a.provider}/${a.model}`
                                            : "sim"}
                                    </span>
                                    <button
                                        onClick={() => onStop(a.id)}
                                        className="text-[color:var(--od-text-dim)] hover:text-[color:var(--od-red)]"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                                <div className="od-ticker">
                                    {a.tone} · every {a.cadence_s}s · targets{" "}
                                    {a.target_networks.join(", ")}
                                </div>
                                <div className="flex items-baseline gap-4 od-mono text-[11px] mt-1">
                                    <span>
                                        posts{" "}
                                        <span className="od-glow-cyan">
                                            {a.posts}
                                        </span>
                                    </span>
                                    <span>
                                        earn{" "}
                                        <span className="od-glow-green">
                                            ${a.total_earnings.toFixed(2)}
                                        </span>
                                    </span>
                                    <span>
                                        imp{" "}
                                        <span className="od-glow-cyan">
                                            {fmtInt(a.total_impressions)}
                                        </span>
                                    </span>
                                    <span>
                                        hook{" "}
                                        <span className="od-glow-green">
                                            {(a.last_quality * 100).toFixed(0)}%
                                        </span>
                                    </span>
                                </div>
                                {a.last_content && (
                                    <div className="od-mono text-[11px] mt-1 text-[color:var(--od-text-dim)] line-clamp-2">
                                        › {a.last_content}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
        </div>
    );
}
