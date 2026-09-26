export function fmtUSD(n) {
    if (n == null || Number.isNaN(n)) return "$0.00";
    const v = Number(n);
    if (Math.abs(v) >= 1_000_000)
        return `$${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 10_000)
        return `$${(v / 1000).toFixed(2)}K`;
    return `$${v.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function fmtInt(n) {
    if (n == null) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
    return Number(n).toLocaleString();
}

export function fmtPct(n, digits = 2) {
    if (n == null) return "0.00%";
    return `${(Number(n) * 100).toFixed(digits)}%`;
}

export function timeAgo(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
}
