"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays } from "date-fns";
import {
    getApprovedClients,
    getAllVacations,
    getTodayDeliveriesAdmin,
    getProducts,
    getAdminSetting,
    setAdminSetting,
    UserDoc,
    ProductDoc,
    DeliveryDoc,
    VacationDoc,
} from "@/lib/firestore";
import {
    BarChart3, Milk, TrendingUp, TrendingDown, Minus,
    Settings2, CheckCircle, AlertTriangle, PlaneLanding,
    CalendarDays, ChevronDown, ChevronUp,
} from "lucide-react";

const SETTING_KEY = "daily_threshold";

interface ClientDemand {
    client: UserDoc;
    expectedQty: number;           // litres for the chosen date
    source: "request" | "default" | "vacation";
    requestedQty?: number;         // if client explicitly requested
    productName: string;
}

function StatusChip({ ratio }: { ratio: number }) {
    if (ratio > 1.1)
        return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" /> HIGH DEMAND — procure extra
            </span>
        );
    if (ratio >= 0.9)
        return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-300 bg-green-500/15 border border-green-500/30 px-3 py-1 rounded-full">
                <Minus className="w-3.5 h-3.5" /> NORMAL — within threshold
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-3 py-1 rounded-full">
            <TrendingDown className="w-3.5 h-3.5" /> LOW DEMAND — surplus expected
        </span>
    );
}

export default function AdminReportsPage() {
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const [selectedDate, setSelectedDate] = useState(tomorrow);

    const [threshold, setThreshold] = useState<number>(30);
    const [thresholdInput, setThresholdInput] = useState("30");
    const [thresholdOpen, setThresholdOpen] = useState(false);
    const [savingThreshold, setSavingThreshold] = useState(false);
    const [thresholdSaved, setThresholdSaved] = useState(false);
    const [thresholdError, setThresholdError] = useState("");

    const [demands, setDemands] = useState<ClientDemand[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        try {
            // Load threshold: Firestore first, localStorage fallback
            let savedThreshold = 30;
            try {
                savedThreshold = await getAdminSetting<number>(SETTING_KEY, 30);
            } catch {
                const local = localStorage.getItem(SETTING_KEY);
                if (local) savedThreshold = parseFloat(local) || 30;
            }
            setThreshold(savedThreshold);
            setThresholdInput(String(savedThreshold));

            const [clients, vacations, deliveries, products] = await Promise.all([
                getApprovedClients(),
                getAllVacations(),
                getTodayDeliveriesAdmin(selectedDate),
                getProducts(),
            ]);

            const isOnVacation = (uid: string) =>
                vacations.some((v: VacationDoc) => v.client_uid === uid && selectedDate >= v.start_date && selectedDate <= v.end_date);
            const getDelivery = (uid: string): DeliveryDoc | undefined =>
                deliveries.find((d: DeliveryDoc) => d.client_uid === uid);
            const getDefaultName = (client: UserDoc, products: ProductDoc[]) =>
                client.defaultProduct
                    ? (products.find((p) => p.id === client.defaultProduct)?.name ?? "Buffalo")
                    : "Buffalo";

            const result: ClientDemand[] = clients.map((client) => {
                if (isOnVacation(client.uid)) {
                    return { client, expectedQty: 0, source: "vacation", productName: getDefaultName(client, products) };
                }
                const del = getDelivery(client.uid);
                if (del) {
                    return { client, expectedQty: del.quantity, requestedQty: del.quantity, source: "request", productName: del.product_name };
                }
                return { client, expectedQty: client.defaultQty ?? 1, source: "default", productName: getDefaultName(client, products) };
            });

            setDemands(result.sort((a, b) => b.expectedQty - a.expectedQty));
        } catch (err) {
            console.error(err);
            setLoadError("Failed to load data. Check Firestore rules are published.");
        }
        setLoading(false);
    }, [selectedDate]);

    useEffect(() => { load(); }, [load]);

    const handleSaveThreshold = async () => {
        const val = parseFloat(thresholdInput);
        if (isNaN(val) || val <= 0) { setThresholdError("Please enter a valid number."); return; }
        setThresholdError("");
        setSavingThreshold(true);
        // Always save to localStorage immediately
        localStorage.setItem(SETTING_KEY, String(val));
        // Try Firestore — non-fatal if rules not published yet
        try {
            await setAdminSetting(SETTING_KEY, val);
        } catch (err) {
            console.warn("Firestore settings write failed (rules not published?), saved locally.", err);
        }
        setThreshold(val);
        setSavingThreshold(false);
        setThresholdSaved(true);
        setThresholdOpen(false);
        setTimeout(() => setThresholdSaved(false), 2000);
    };

    const totalExpected = demands.reduce((s, d) => s + d.expectedQty, 0);
    const requestedClients = demands.filter((d) => d.source === "request");
    const vacationClients = demands.filter((d) => d.source === "vacation");
    const defaultClients = demands.filter((d) => d.source === "default");
    const ratio = threshold > 0 ? totalExpected / threshold : 1;
    const surplus = threshold - totalExpected;

    // Buffalo vs Cow breakdown
    const buffaloTotal = demands.filter(d => d.productName === "Buffalo").reduce((s, d) => s + d.expectedQty, 0);
    const cowTotal = demands.filter(d => d.productName === "Cow").reduce((s, d) => s + d.expectedQty, 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-white font-bold text-lg">Procurement Report</h1>
                            <p className="text-indigo-300 text-sm">Expected demand vs your daily capacity</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setThresholdOpen(o => !o)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/60 hover:text-white rounded-xl text-xs transition-colors"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        {threshold}L cap
                        {thresholdOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                </div>

                {/* Threshold setter */}
                {thresholdOpen && (
                    <div className="mt-4 bg-white/5 rounded-xl p-4 space-y-3">
                        <p className="text-white/50 text-xs uppercase tracking-wider">Daily Capacity (litres you can deliver)</p>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="1"
                                step="0.5"
                                value={thresholdInput}
                                onChange={(e) => { setThresholdInput(e.target.value); setThresholdError(""); }}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveThreshold()}
                                className="flex-1 bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 [appearance:textfield]"
                                placeholder="e.g. 30"
                            />
                            <button
                                onClick={handleSaveThreshold}
                                disabled={savingThreshold || thresholdSaved}
                                className="px-4 py-2 font-semibold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center gap-1.5"
                                style={{ background: thresholdSaved ? "#22c55e" : "#6366f1", color: "#fff" }}
                            >
                                {thresholdSaved ? <><CheckCircle className="w-4 h-4" /> Saved</> :
                                    savingThreshold ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> :
                                        "Save"}
                            </button>
                        </div>
                        {thresholdError && <p className="text-red-400 text-xs">{thresholdError}</p>}
                        <p className="text-white/30 text-xs">Saved locally + to Firestore (publish rules to sync across devices).</p>
                    </div>
                )}
            </div>

            {/* Date picker */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <CalendarDays className="w-4 h-4 text-white/50 flex-shrink-0" />
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
                />
            </div>

            {loadError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-300 text-sm">
                    ⚠️ {loadError}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Summary card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Total Expected</p>
                                <p className="text-4xl font-bold text-white">{totalExpected.toFixed(1)}<span className="text-xl text-white/40 ml-1">L</span></p>
                                <p className="text-white/40 text-xs mt-1">of {threshold}L capacity</p>
                            </div>
                            <div className="text-right space-y-1">
                                <StatusChip ratio={ratio} />
                                <p className={`text-sm font-semibold ${surplus >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {surplus >= 0 ? `+${surplus.toFixed(1)}L surplus` : `${Math.abs(surplus).toFixed(1)}L shortfall`}
                                </p>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${ratio > 1.1 ? "bg-red-500" : ratio >= 0.9 ? "bg-green-500" : "bg-blue-500"}`}
                                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-white/30">
                                <span>0L</span>
                                <span>{threshold}L capacity</span>
                            </div>
                        </div>

                        {/* Type breakdown */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                <p className="text-amber-300 text-xs uppercase tracking-wider mb-1">Buffalo</p>
                                <p className="text-white font-bold text-xl">{buffaloTotal.toFixed(1)}L</p>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                <p className="text-blue-300 text-xs uppercase tracking-wider mb-1">Cow</p>
                                <p className="text-white font-bold text-xl">{cowTotal.toFixed(1)}L</p>
                            </div>
                        </div>

                        {/* Counts */}
                        <div className="flex gap-4 text-xs text-white/40 flex-wrap">
                            <span>✅ {requestedClients.length} explicit request{requestedClients.length !== 1 ? "s" : ""}</span>
                            <span>📋 {defaultClients.length} using default</span>
                            <span>✈️ {vacationClients.length} on vacation</span>
                        </div>
                    </div>

                    {/* Per-client breakdown */}
                    <div className="space-y-2">
                        <p className="text-white/40 text-xs uppercase tracking-wider px-1">Client Breakdown</p>

                        {demands.map((d) => (
                            <div
                                key={d.client.uid}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${d.source === "vacation"
                                    ? "bg-purple-500/5 border-purple-500/15 opacity-60"
                                    : d.source === "request"
                                        ? "bg-amber-500/5 border-amber-500/15"
                                        : "bg-white/5 border-white/10"
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {d.client.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Name + source */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{d.client.name}</p>
                                    <p className="text-white/35 text-xs">
                                        {d.source === "vacation" ? "🏖️ On vacation — no delivery" :
                                            d.source === "request" ? "📬 Client requested" :
                                                "📋 Using default"}
                                        {" · "}{d.productName}
                                    </p>
                                </div>

                                {/* Qty */}
                                <div className="text-right flex-shrink-0">
                                    {d.source === "vacation" ? (
                                        <PlaneLanding className="w-5 h-5 text-purple-400" />
                                    ) : (
                                        <>
                                            <p className={`font-bold text-sm ${d.source === "request" ? "text-amber-300" : "text-white/70"}`}>
                                                {d.expectedQty.toFixed(1)}L
                                            </p>
                                            {d.source === "request" && (
                                                <p className="text-white/30 text-xs">requested</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {demands.length === 0 && (
                        <div className="text-center py-12">
                            <Milk className="w-10 h-10 text-white/10 mx-auto mb-2" />
                            <p className="text-white/30 text-sm">No approved clients found.</p>
                        </div>
                    )}

                    {/* Warning */}
                    {ratio > 1.1 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-300 font-semibold text-sm">Action Required</p>
                                <p className="text-red-300/70 text-xs mt-0.5">
                                    Expected demand ({totalExpected.toFixed(1)}L) exceeds your daily capacity ({threshold}L) by{" "}
                                    <strong>{Math.abs(surplus).toFixed(1)}L</strong>. Consider procuring extra milk from alternate sources.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
