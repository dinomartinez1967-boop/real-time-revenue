import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, ShieldCheck, ShieldAlert, Radio } from "lucide-react";
import {
    setMode,
    armDriver,
    driversStatus,
    routeOrder,
    publishListing,
} from "../lib/api";

/**
 * Graduated Mode dialog — the ONLY place where an operator can flip real
 * integrations on. Sandbox mode force-disables everything.
 */
export default function GraduatedPanel({ mode, onClose, onChanged }) {
    const [drivers, setDrivers] = useState(null);
    const [busy, setBusy] = useState(false);
    const [testProduct, setTestProduct] = useState("Ceramic Diffuser");
    const [testTitle, setTestTitle] = useState("Home Aroma Kit");

    async function refresh() {
        const s = await driversStatus();
        setDrivers(s);
    }
    useEffect(() => {
        refresh();
    }, [mode]);

    async function onToggleMode(next) {
        setBusy(true);
        try {
            const s = await setMode(next);
            toast.success(`mode → ${s.mode}`);
            onChanged?.(s);
            await refresh();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "mode switch failed");
        } finally {
            setBusy(false);
        }
    }

    async function onArm(name, on) {
        try {
            const s = await armDriver(name, on);
            toast.message(`${name} → ${on ? "armed" : "disarmed"}`);
            onChanged?.(s);
            await refresh();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "arm failed");
        }
    }

    async function testOrder() {
        const r = await routeOrder({
            product: testProduct,
            quantity: 1,
            customer_ref: "test-op",
        });
        toast.message(
            r.status === "not_armed"
                ? "supplier not armed (MOCKED)"
                : `order routed: ${r.status}`,
        );
    }

    async function testListing() {
        const r = await publishListing({
            title: testTitle,
            price: 39.9,
            description: "AI-crafted product description",
        });
        toast.message(
            r.status === "not_armed"
                ? "marketplace not armed (MOCKED)"
                : `listing: ${r.status}`,
        );
    }

    const isGrad = mode === "graduated";

    return (
        <div
            className="fixed inset-0 z-40 flex items-stretch justify-end"
            data-testid="graduated-panel"
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <aside className="relative w-full max-w-xl od-panel od-panel-hot flex flex-col">
                <div className="px-4 py-3 border-b border-[color:var(--od-border)] flex items-center gap-3">
                    {isGrad ? (
                        <ShieldAlert size={16} style={{ color: "#ffb454" }} />
                    ) : (
                        <ShieldCheck size={16} className="od-glow-green" />
                    )}
                    <div className="flex-1">
                        <div className="od-mono text-sm od-glow-green">
                            graduated mode
                        </div>
                        <div className="od-label mt-0.5">
                            real integrations · isolated from sandbox
                        </div>
                    </div>
                    <button
                        data-testid="close-graduated"
                        className="text-[color:var(--od-text-dim)] hover:text-[color:var(--od-red)]"
                        onClick={onClose}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto od-scroll">
                    {/* Mode toggle */}
                    <div className="od-panel p-3">
                        <div className="od-label mb-2">runtime mode</div>
                        <div className="flex gap-2">
                            <ModeBtn
                                testid="mode-sandbox"
                                label="sandbox"
                                active={!isGrad}
                                onClick={() => onToggleMode("sandbox")}
                                disabled={busy}
                                hint="all activity synthetic. safe."
                            />
                            <ModeBtn
                                testid="mode-graduated"
                                label="graduated"
                                active={isGrad}
                                warn
                                onClick={() => onToggleMode("graduated")}
                                disabled={busy}
                                hint="real drivers can be armed. verify keys."
                            />
                        </div>
                    </div>

                    {/* Drivers */}
                    <div className="od-panel p-3">
                        <div className="od-label mb-2">
                            production drivers // only armable in graduated mode
                        </div>
                        <div className="space-y-2">
                            <DriverRow
                                testid="arm-llm"
                                label="Real LLM Brains (Emergent Universal Key)"
                                sub="GPT-5.4 · Claude Sonnet 4.6 · Gemini 3.1 Pro"
                                driver="llm_real"
                                mode={mode}
                                drivers={drivers}
                                extra={
                                    drivers?.mode?.drivers &&
                                    !drivers.mode.drivers.llm_real
                                        ? "sandbox uses deterministic sim"
                                        : null
                                }
                                on={mode === "graduated" && drivers?.mode?.drivers?.llm_real}
                                onArm={onArm}
                            />
                            <DriverRow
                                testid="arm-supplier"
                                label="Dropdashin supplier routing"
                                sub={
                                    drivers?.supplier?.credentials_present
                                        ? "credentials present"
                                        : "no supplier API key yet (endpoint stubbed)"
                                }
                                driver="dropdashin_supplier"
                                mode={mode}
                                drivers={drivers}
                                on={
                                    mode === "graduated" &&
                                    drivers?.mode?.drivers?.dropdashin_supplier
                                }
                                onArm={onArm}
                            />
                            <DriverRow
                                testid="arm-fbmp"
                                label="Facebook Marketplace"
                                sub={
                                    drivers?.facebook_marketplace?.token_present
                                        ? "access token present"
                                        : "requires FB commerce review + token"
                                }
                                driver="facebook_marketplace"
                                mode={mode}
                                drivers={drivers}
                                on={
                                    mode === "graduated" &&
                                    drivers?.mode?.drivers?.facebook_marketplace
                                }
                                onArm={onArm}
                            />
                        </div>
                    </div>

                    {/* Test panel */}
                    <div className="od-panel p-3">
                        <div className="od-label mb-2 flex items-center gap-2">
                            <Radio size={12} /> smoke test
                        </div>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm"
                                    value={testProduct}
                                    onChange={(e) => setTestProduct(e.target.value)}
                                    placeholder="product"
                                />
                                <button
                                    data-testid="route-order-btn"
                                    onClick={testOrder}
                                    className="od-mono uppercase text-[10px] px-3 border border-[color:var(--od-cyan)] text-[color:var(--od-cyan)] hover:bg-[color:var(--od-cyan)] hover:text-black rounded-sm"
                                >
                                    route order
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-[color:var(--od-bg)] border border-[color:var(--od-border-hot)] px-2 py-1.5 od-mono text-xs rounded-sm"
                                    value={testTitle}
                                    onChange={(e) => setTestTitle(e.target.value)}
                                    placeholder="listing title"
                                />
                                <button
                                    data-testid="publish-listing-btn"
                                    onClick={testListing}
                                    className="od-mono uppercase text-[10px] px-3 border border-[color:var(--od-cyan)] text-[color:var(--od-cyan)] hover:bg-[color:var(--od-cyan)] hover:text-black rounded-sm"
                                >
                                    publish listing
                                </button>
                            </div>
                            <p className="od-ticker">
                                calls always return a structured `mocked` payload
                                until real credentials are set — sandbox stays
                                isolated.
                            </p>
                        </div>
                    </div>

                    <p className="od-ticker">
                        switching back to <span className="od-glow-green">sandbox</span> instantly disarms every real driver and halts the swarm — a hard safety rail.
                    </p>
                </div>
            </aside>
        </div>
    );
}

function ModeBtn({ label, active, onClick, disabled, hint, warn, testid }) {
    const color = warn ? "#ffb454" : "var(--od-green)";
    return (
        <button
            data-testid={testid}
            onClick={onClick}
            disabled={disabled}
            className="flex-1 od-panel p-2 text-left transition disabled:opacity-50"
            style={{
                borderColor: active ? color : undefined,
                background: active ? `${warn ? "#ffb45411" : "#00ff6611"}` : undefined,
            }}
        >
            <div
                className="od-mono uppercase text-xs tracking-widest"
                style={{ color: active ? color : "var(--od-text-dim)" }}
            >
                {label}
            </div>
            <div className="od-ticker mt-0.5">{hint}</div>
        </button>
    );
}

function DriverRow({ testid, label, sub, driver, mode, on, onArm, extra }) {
    const canArm = mode === "graduated";
    return (
        <div className="flex items-center gap-3 border border-[color:var(--od-border)] rounded-sm p-2">
            <div className="flex-1 min-w-0">
                <div className="od-mono text-[12px] truncate">{label}</div>
                <div className="od-ticker">{sub}</div>
                {extra && <div className="od-ticker">{extra}</div>}
            </div>
            <button
                data-testid={testid}
                disabled={!canArm}
                onClick={() => onArm(driver, !on)}
                className={`od-mono uppercase text-[10px] px-2 py-1 border rounded-sm ${
                    on
                        ? "border-[color:var(--od-cyan)] text-[color:var(--od-cyan)]"
                        : "border-[color:var(--od-border-hot)] text-[color:var(--od-text-dim)]"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={canArm ? "toggle driver" : "switch to graduated mode first"}
            >
                {on ? "armed" : "disarmed"}
            </button>
        </div>
    );
}
