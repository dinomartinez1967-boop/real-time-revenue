import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip, CartesianGrid } from "recharts";
import { fmtUSD, fmtInt, fmtPct } from "../lib/format";

export default function TopMetrics({ totals, series }) {
    const conv = totals?.conv_rate ?? 0;
    const rev = totals?.earnings ?? 0;
    const impressions = totals?.impressions ?? 0;
    const impPerSec =
        series && series.length > 0 ? series[series.length - 1].imp_per_sec : 0;

    return (
        <div className="od-panel od-panel-hot p-4" data-testid="top-metrics">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="od-diode" />
                    <span className="od-label">
                        real-time analytics // 1hz ws stream
                    </span>
                </div>
                <div className="od-ticker">
                    tick <span className="od-glow-cyan">{series?.length || 0}</span>{" "}
                    • samples 60s
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <MetricCard
                    label="total earnings"
                    value={fmtUSD(rev)}
                    accent="green"
                    testid="metric-earnings"
                    sub={`${fmtUSD(series?.at?.(-1)?.earnings_delta || 0)} / sec`}
                />
                <MetricCard
                    label="aggregated traffic"
                    value={`${fmtInt(impPerSec)}/s`}
                    accent="cyan"
                    testid="metric-traffic"
                    sub={`${fmtInt(impressions)} total impressions`}
                />
                <MetricCard
                    label="avg conversion"
                    value={fmtPct(conv, 3)}
                    accent="green"
                    testid="metric-conv"
                    sub={`${fmtInt(totals?.conversions || 0)} conversions`}
                />
            </div>

            <div style={{ height: 168 }} data-testid="live-chart">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series || []}>
                        <CartesianGrid stroke="#152028" strokeDasharray="2 6" />
                        <XAxis
                            dataKey="t"
                            stroke="#4a5b6a"
                            fontSize={10}
                            tick={{ fontFamily: "JetBrains Mono, monospace" }}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#00ff66"
                            fontSize={10}
                            tick={{ fontFamily: "JetBrains Mono, monospace" }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#00f0ff"
                            fontSize={10}
                            tick={{ fontFamily: "JetBrains Mono, monospace" }}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "#0a1015",
                                border: "1px solid #204050",
                                borderRadius: 2,
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: 11,
                                color: "#d6f0ea",
                            }}
                            labelStyle={{ color: "#4a5b6a" }}
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="earnings_total"
                            name="revenue $"
                            stroke="#00FF66"
                            strokeWidth={1.6}
                            dot={false}
                            isAnimationActive={false}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="imp_per_sec"
                            name="imp/sec"
                            stroke="#00F0FF"
                            strokeWidth={1.4}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, accent, testid }) {
    const cls = accent === "green" ? "od-glow-green" : "od-glow-cyan";
    return (
        <div
            className="od-panel p-3 flex flex-col justify-between"
            data-testid={testid}
        >
            <div className="od-label">{label}</div>
            <div className={`od-mono od-num ${cls} text-3xl mt-2 font-bold`}>
                {value}
            </div>
            <div className="mt-1 od-mono text-[10px] text-[color:var(--od-text-dim)]">
                {sub}
            </div>
        </div>
    );
}
