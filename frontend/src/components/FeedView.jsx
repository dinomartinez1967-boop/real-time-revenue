import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { publishPost, fetchFeed, flushSandbox } from "../lib/api";
import { fmtInt, fmtPct, timeAgo } from "../lib/format";
import NetIcon from "./NetIcon";
import { Send, Trash2, Loader2 } from "lucide-react";

/**
 * Feed view for a single network. Polls the feed endpoint every 2s and
 * lets the operator publish new posts through the LLM gateway.
 * Dropdashin gets a bespoke store-inspector panel.
 */
export default function FeedView({ network, netMeta, snapshotNet, dropdashin }) {
    const [feed, setFeed] = useState([]);
    const [prompt, setPrompt] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        async function pull() {
            try {
                const data = await fetchFeed(network);
                if (alive) setFeed(data);
            } catch {
                /* ignore */
            }
        }
        pull();
        const id = setInterval(pull, 2000);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [network]);

    const isDropdashin = network === "dropdashin";

    async function onPublish() {
        if (!prompt.trim() || busy) return;
        setBusy(true);
        try {
            const result = await publishPost(network, prompt.trim(), true);
            toast.success(
                `Published to ${netMeta?.name} • hook ${(result.llm.quality * 100).toFixed(0)}%`,
            );
            setPrompt("");
            // optimistic prepend
            setFeed((prev) => [result.post, ...prev]);
        } catch {
            toast.error("publish failed");
        } finally {
            setBusy(false);
        }
    }

    async function onFlush() {
        await flushSandbox();
        toast.message("sandbox flushed");
    }

    return (
        <div
            className="od-panel h-full flex flex-col"
            data-testid={`feed-${network}`}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[color:var(--od-border)] flex items-center gap-3">
                <div
                    className="w-8 h-8 rounded-sm flex items-center justify-center"
                    style={{
                        background: `${netMeta?.color}20`,
                        border: `1px solid ${netMeta?.color}55`,
                        color: netMeta?.color,
                    }}
                >
                    <NetIcon name={netMeta?.icon} size={16} />
                </div>
                <div className="flex-1">
                    <div className="od-mono text-sm">
                        {netMeta?.name}{" "}
                        <span className="text-[color:var(--od-text-dim)] text-[10px] ml-1">
                            {netMeta?.handle}
                        </span>
                    </div>
                    <div className="od-label mt-0.5">
                        VirtualScreenState :: /feeds/{network}
                    </div>
                </div>
                <NetStats snap={snapshotNet} />
                <button
                    data-testid="flush-btn"
                    onClick={onFlush}
                    className="ml-2 flex items-center gap-1 od-mono text-[11px] uppercase px-2 py-1.5 border border-[color:var(--od-border-hot)] hover:border-[color:var(--od-red)] hover:text-[color:var(--od-red)] text-[color:var(--od-text-dim)] rounded-sm"
                    title="flush sandbox"
                >
                    <Trash2 size={12} /> flush
                </button>
            </div>

            {/* Algo vars bar */}
            <AlgoBar snap={snapshotNet} />

            {/* Publish composer */}
            <div className="px-4 py-3 border-b border-[color:var(--od-border)] bg-[color:var(--od-panel-2)]">
                <div className="od-label mb-2">agent // publish</div>
                <div className="flex gap-2">
                    <textarea
                        data-testid="publish-input"
                        placeholder={
                            isDropdashin
                                ? "prompt AI to write a product description..."
                                : "type a brief for the agent — it will craft a post and publish"
                        }
                        rows={2}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="flex-1 bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] text-[color:var(--od-text)] od-mono text-xs px-3 py-2 rounded-sm focus:outline-none focus:border-[color:var(--od-green)] resize-none"
                    />
                    <button
                        data-testid="publish-btn"
                        onClick={onPublish}
                        disabled={busy || !prompt.trim()}
                        className="od-mono text-xs uppercase tracking-widest px-4 border border-[color:var(--od-green)] text-[color:var(--od-green)] hover:bg-[color:var(--od-green)] hover:text-black disabled:opacity-40 disabled:cursor-not-allowed rounded-sm flex items-center gap-2"
                    >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        deploy
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto od-scroll">
                {isDropdashin ? (
                    <DropdashinPanel dropdashin={dropdashin} />
                ) : (
                    <FeedList feed={feed} netColor={netMeta?.color} />
                )}
            </div>
        </div>
    );
}

function NetStats({ snap }) {
    if (!snap) return null;
    return (
        <div className="flex items-center gap-4 od-mono text-[10px]">
            <Stat label="hook" val={(snap.hook_score * 100).toFixed(0) + "%"} />
            <Stat label="cpm" val={"$" + snap.cpm.toFixed(2)} />
            <Stat label="ctr" val={fmtPct(snap.ctr, 2)} />
            <Stat label="rev" val={"$" + fmtInt(snap.earnings)} accent />
        </div>
    );
}

function Stat({ label, val, accent }) {
    return (
        <div className="text-center">
            <div className="od-label text-[9px]">{label}</div>
            <div
                className={`od-num ${accent ? "od-glow-green" : "text-[color:var(--od-text)]"}`}
            >
                {val}
            </div>
        </div>
    );
}

function AlgoBar({ snap }) {
    const entries = useMemo(
        () => (snap ? Object.entries(snap.algo || {}) : []),
        [snap],
    );
    if (!entries.length) return null;
    return (
        <div
            className="flex gap-3 overflow-x-auto od-scroll px-4 py-2 border-b border-[color:var(--od-border)] bg-[color:var(--od-panel)]"
            data-testid="algo-bar"
        >
            {entries.map(([k, v]) => (
                <div
                    key={k}
                    className="min-w-[160px] flex-shrink-0 border border-[color:var(--od-border)] rounded-sm px-2 py-1.5"
                >
                    <div className="od-label text-[9px] truncate">{k}</div>
                    <div className="od-num od-glow-cyan text-sm">
                        {typeof v === "number"
                            ? v > 100
                                ? v.toFixed(0)
                                : v.toFixed(2)
                            : String(v)}
                    </div>
                </div>
            ))}
        </div>
    );
}

function FeedList({ feed, netColor }) {
    if (!feed.length) {
        return (
            <div className="p-6 text-center od-label">
                waiting for feed // no signal yet
            </div>
        );
    }
    return (
        <ul className="divide-y divide-[color:var(--od-border)]">
            {feed.map((post) => (
                <li key={post.post_id} className="px-4 py-3 od-flash-in">
                    <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <span
                                className="w-1 h-4"
                                style={{ background: netColor }}
                            />
                            <span className="od-mono text-xs truncate">
                                @{post.author}
                            </span>
                            {post.author_metrics?.verified && (
                                <span className="text-[9px] od-mono od-glow-cyan uppercase">
                                    ✓ premium
                                </span>
                            )}
                            <span className="od-ticker">
                                {fmtInt(post.author_metrics?.followers)} followers
                            </span>
                        </div>
                        <span className="od-ticker">{timeAgo(post.created_at)} ago</span>
                    </div>

                    <p className="mt-2 od-mono text-[13px] text-[color:var(--od-text)] leading-relaxed">
                        {post.content}
                    </p>

                    <div className="mt-2 flex items-center gap-4 od-ticker">
                        <span>
                            weight{" "}
                            <span className="od-glow-green">
                                {(post.algorithmic_weight * 100).toFixed(0)}
                            </span>
                        </span>
                        <span>
                            sent{" "}
                            <span
                                className={
                                    post.sentiment_index > 0
                                        ? "od-glow-green"
                                        : "text-[color:var(--od-red)]"
                                }
                            >
                                {post.sentiment_index > 0 ? "+" : ""}
                                {post.sentiment_index.toFixed(2)}
                            </span>
                        </span>
                        <span>
                            👁 {fmtInt(post.stats?.views)} · ❤ {fmtInt(post.stats?.likes)} ·{" "}
                            💬 {fmtInt(post.stats?.comments)} · ↻ {fmtInt(post.stats?.shares)}
                        </span>
                    </div>

                    {post.comments?.length > 0 && (
                        <ul className="mt-3 pl-4 border-l border-[color:var(--od-border)] space-y-1">
                            {post.comments.slice(0, 4).map((c) => (
                                <li key={c.id} className="od-mono text-[11px]">
                                    <span className="text-[color:var(--od-text-dim)]">
                                        @{c.author}
                                    </span>{" "}
                                    <span
                                        className={
                                            c.sentiment === "positive"
                                                ? "text-[color:var(--od-green)]"
                                                : c.sentiment === "negative"
                                                  ? "text-[color:var(--od-red)]"
                                                  : c.sentiment === "buyer"
                                                    ? "od-glow-cyan"
                                                    : "text-[color:var(--od-text)]"
                                        }
                                    >
                                        {c.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
}

function DropdashinPanel({ dropdashin }) {
    if (!dropdashin) return null;
    return (
        <div className="p-4 space-y-4" data-testid="dropdashin-panel">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="orders" val={fmtInt(dropdashin.orders)} accent="green" />
                <Kpi
                    label="net profit"
                    val={"$" + (dropdashin.net_profit || 0).toFixed(2)}
                    accent="green"
                />
                <Kpi
                    label="gross sales"
                    val={"$" + (dropdashin.gross_sales || 0).toFixed(2)}
                    accent="cyan"
                />
                <Kpi
                    label="ad spend"
                    val={"$" + (dropdashin.ad_spend || 0).toFixed(2)}
                />
                <Kpi label="stock" val={fmtInt(dropdashin.stock)} />
                <Kpi
                    label="cart abandoned"
                    val={fmtInt(dropdashin.cart_abandoned)}
                />
                <Kpi
                    label="cart recovered"
                    val={fmtInt(dropdashin.cart_recovered)}
                    accent="cyan"
                />
                <Kpi
                    label="product retail"
                    val={"$" + (dropdashin.product?.retail || 0).toFixed(2)}
                />
            </div>

            <div>
                <div className="od-label mb-2">recent orders // cross-platform pixels</div>
                <div className="border border-[color:var(--od-border)] rounded-sm divide-y divide-[color:var(--od-border)]">
                    {(dropdashin.recent_orders || []).length === 0 && (
                        <div className="p-3 od-ticker">no orders yet — waiting on IG/TT hooks</div>
                    )}
                    {(dropdashin.recent_orders || []).map((o) => (
                        <div
                            key={o.id}
                            className="flex items-center justify-between p-2 od-mono text-[11px] od-flash-in"
                        >
                            <span className="od-glow-green">#{o.id}</span>
                            <span className="text-[color:var(--od-text)]">
                                {o.from}
                            </span>
                            <span className="od-num od-glow-cyan">
                                ${o.amount.toFixed(2)}
                            </span>
                            <span className="od-ticker">{timeAgo(o.ts)} ago</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border border-dashed border-[color:var(--od-border-hot)] p-3 rounded-sm">
                <div className="od-label mb-1">graduated mode</div>
                <p className="od-mono text-[11px] text-[color:var(--od-text-dim)]">
                    when sandbox → live, the store connects to real dropshipping
                    APIs (product sync, SEO copy, order routing to supplier).
                    OpenDroid-style screen automation kicks in for platforms
                    without APIs.
                </p>
            </div>
        </div>
    );
}

function Kpi({ label, val, accent }) {
    const cls = accent === "green" ? "od-glow-green" : accent === "cyan" ? "od-glow-cyan" : "text-[color:var(--od-text)]";
    return (
        <div className="od-panel p-2">
            <div className="od-label text-[9px]">{label}</div>
            <div className={`od-mono od-num text-lg ${cls}`}>{val}</div>
        </div>
    );
}
