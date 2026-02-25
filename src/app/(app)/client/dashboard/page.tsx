"use client";

import { useAuth } from "@/context/AuthContext";
import { CalendarView } from "@/components/ui/CalendarView";
import { ChipSelector } from "@/components/ui/ChipSelector";
import {
    getDeliveriesForClient,
    getVacationsForClient,
    logDelivery,
    getProducts,
    recalcInvoice,
    raiseDeliveryDispute,
    setClientDefault,
    deleteVacation,
    DeliveryDoc,
    VacationDoc,
    ProductDoc,
} from "@/lib/firestore";
import { format, addMonths, subMonths, isSameMonth, isFuture, startOfDay, isPast } from "date-fns";
import { useEffect, useState, useCallback } from "react";
import {
    Milk, TrendingUp, X, CheckCircle, PlaneLanding,
    CalendarDays, Pencil, AlertTriangle, BookmarkCheck, Settings2, User,
} from "lucide-react";

const QTY_OPTIONS = ["0.5L", "1.0L", "1.5L", "2.0L", "Custom"];
const TYPE_OPTIONS = ["Buffalo", "Cow"];

// ── Day Detail Panel ──────────────────────────────────────────────────────────
function DayPanel({
    date,
    delivery,
    vacationRecord,
    products,
    userDoc,
    onSave,
    onDispute,
    onSetDefault,
    onCancelVacation,
    onClose,
}: {
    date: Date;
    delivery: DeliveryDoc | null;
    vacationRecord: VacationDoc | null;
    products: ProductDoc[];
    userDoc: { uid: string; defaultProduct?: string; defaultQty?: number; name?: string } | null;
    onSave: (type: string, qty: string) => Promise<void>;
    onDispute: (deliveryId: string, claimedQty: number, note: string) => Promise<void>;
    onSetDefault: (type: string, qty: number, productId: string) => Promise<void>;
    onCancelVacation: (v: VacationDoc) => Promise<void>;
    onClose: () => void;
}) {
    const vacation = !!vacationRecord;

    const defaultTypeName = userDoc?.defaultProduct
        ? (products.find((p) => p.id === userDoc.defaultProduct)?.name ?? "Buffalo")
        : "Buffalo";
    const defaultQtyStr = userDoc?.defaultQty ? `${userDoc.defaultQty.toFixed(1)}L` : "1.0L";

    const initQty = delivery
        ? (QTY_OPTIONS.slice(0, -1).includes(`${delivery.quantity.toFixed(1)}L`)
            ? `${delivery.quantity.toFixed(1)}L`
            : "Custom")
        : (QTY_OPTIONS.slice(0, -1).includes(defaultQtyStr) ? defaultQtyStr : "Custom");

    const [type, setType] = useState<string>(delivery?.product_name ?? defaultTypeName);
    const [qty, setQty] = useState<string>(initQty);
    const [customQty, setCustomQty] = useState<string>(
        delivery ? String(delivery.quantity) : String(userDoc?.defaultQty ?? 1)
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Dispute state
    const [showDispute, setShowDispute] = useState(false);
    const [disputeQty, setDisputeQty] = useState<string>(`${(delivery?.quantity ?? 1).toFixed(1)}L`);
    const [disputeNote, setDisputeNote] = useState("");
    const [disputeSaving, setDisputeSaving] = useState(false);
    const [disputeDone, setDisputeDone] = useState(false);

    // Default state
    const [settingDefault, setSettingDefault] = useState(false);
    const [defaultDone, setDefaultDone] = useState(false);

    useEffect(() => {
        const dqStr = delivery ? `${delivery.quantity.toFixed(1)}L` : defaultQtyStr;
        const chipMatch = QTY_OPTIONS.slice(0, -1).includes(dqStr) ? dqStr : "Custom";
        setType(delivery?.product_name ?? defaultTypeName);
        setQty(chipMatch);
        setCustomQty(delivery ? String(delivery.quantity) : String(userDoc?.defaultQty ?? 1));
        setDisputeQty(`${(delivery?.quantity ?? 1).toFixed(1)}L`);
        setShowDispute(false);
        setSaved(false);
        setDisputeDone(false);
        setDefaultDone(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [delivery, date]);

    // Resolve final quantity string
    const resolvedQty = qty === "Custom" ? `${parseFloat(customQty || "1").toFixed(1)}L` : qty;

    const handleSave = async () => {
        setSaving(true);
        await onSave(type, resolvedQty);
        setSaved(true);
        setSaving(false);
        setTimeout(() => { setSaved(false); onClose(); }, 1200);
    };

    const handleDispute = async () => {
        if (!delivery?.id) return;
        setDisputeSaving(true);
        const qtyNum = parseFloat(disputeQty.replace("L", ""));
        await onDispute(delivery.id, qtyNum, disputeNote);
        setDisputeSaving(false);
        setDisputeDone(true);
        setTimeout(() => onClose(), 1500);
    };

    const handleSetDefault = async () => {
        setSettingDefault(true);
        const product = products.find((p) => p.name === type);
        const qtyNum = parseFloat(resolvedQty.replace("L", ""));
        await onSetDefault(type, qtyNum, product?.id ?? "");
        setSettingDefault(false);
        setDefaultDone(true);
        setTimeout(() => onClose(), 1200);
    };

    const dateStr = format(date, "EEEE, d MMMM");
    const isFutureDay = isFuture(startOfDay(date));
    const isPastDay = isPast(startOfDay(date));
    // Amber if client-logged (source === "client") OR future; green only if admin-confirmed
    const isClientLogged = delivery?.source === "client" || (delivery && !delivery.confirmed);
    const showAmber = isFutureDay || isClientLogged;
    const alreadyDisputed = delivery?.dispute_status === "Pending";
    const disputeApproved = delivery?.dispute_status === "Approved";
    const disputeRejected = delivery?.dispute_status === "Rejected";

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in-up">
                <div className="bg-blue-950 border-t border-white/10 rounded-t-3xl p-6 pb-28 max-w-lg mx-auto shadow-2xl space-y-5">

                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <CalendarDays className="w-5 h-5 text-white/70" />
                                <p className="text-white text-sm font-semibold">{dateStr}</p>
                            </div>
                            {vacation ? (
                                <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 text-xs text-purple-300 bg-purple-500/15 border border-purple-500/25 px-2 py-0.5 rounded-full">
                                        <PlaneLanding className="w-3 h-3" /> On Leave
                                    </span>
                                    {vacationRecord && (
                                        <p className="text-white/35 text-xs">
                                            {vacationRecord.start_date} → {vacationRecord.end_date}
                                        </p>
                                    )}
                                </div>
                            ) : delivery ? (
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${showAmber
                                    ? "text-amber-300 bg-amber-500/15 border-amber-500/25"
                                    : "text-green-300 bg-green-500/15 border-green-500/25"
                                    }`}>
                                    <CheckCircle className="w-3 h-3" />
                                    {delivery.quantity.toFixed(1)}L {delivery.product_name}{" "}
                                    {showAmber ? "requested" : "confirmed ✓"}
                                    {alreadyDisputed && " · 🔴 Dispute Pending"}
                                    {disputeApproved && " · ✅ Dispute Approved"}
                                    {disputeRejected && " · ❌ Dispute Rejected"}
                                </span>
                            ) : (
                                <span className="text-xs text-white/40">No delivery logged</span>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/40">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Log / Update entry */}
                    {!vacation && (
                        <div className="space-y-3">
                            <p className="text-white/50 text-xs uppercase tracking-widest flex items-center gap-1.5">
                                <Pencil className="w-3 h-3" />
                                {isFutureDay ? "Request for this day" : delivery ? "Update Delivery" : "Log Delivery"}
                            </p>
                            <div>
                                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Milk Type</p>
                                <ChipSelector options={TYPE_OPTIONS} selected={type} onChange={setType} />
                            </div>
                            <div>
                                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Quantity</p>
                                <ChipSelector options={QTY_OPTIONS} selected={qty} onChange={setQty} />
                                {qty === "Custom" && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={customQty}
                                            onChange={(e) => setCustomQty(e.target.value)}
                                            step="0.1"
                                            min="0.1"
                                            max="10"
                                            className="flex-1 bg-white/5 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                            placeholder="e.g. 2.5"
                                        />
                                        <span className="text-white/40 text-sm">Litres</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || saved}
                                    className="flex-1 py-3 font-bold text-white rounded-2xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
                                    style={{ background: saved ? "#22c55e" : "#3b82f6" }}
                                >
                                    {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> :
                                        saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> :
                                            <><Milk className="w-4 h-4" />{delivery ? "Update Delivery" : "Log Delivery"}</>}
                                </button>

                                <button
                                    onClick={handleSetDefault}
                                    disabled={settingDefault || defaultDone}
                                    title="Set as my daily default"
                                    className="px-3 py-3 rounded-2xl border transition-all active:scale-95 disabled:opacity-70 flex items-center gap-1.5 text-xs font-medium"
                                    style={{
                                        background: defaultDone ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                                        borderColor: defaultDone ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)",
                                        color: defaultDone ? "#86efac" : "#94a3b8"
                                    }}
                                >
                                    {defaultDone ? <BookmarkCheck className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                                    {defaultDone ? "Default set!" : "Set Default"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Vacation day info + cancel */}
                    {vacation && vacationRecord && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <PlaneLanding className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                <div>
                                    <p className="text-purple-300 text-sm font-medium">Delivery Paused</p>
                                    <p className="text-white/40 text-xs">{vacationRecord.start_date} → {vacationRecord.end_date}</p>
                                </div>
                            </div>
                            <p className="text-white/35 text-xs">No milk will be delivered on this date. This day will not be billed.</p>
                            {vacationRecord.reason && (
                                <p className="text-white/30 text-xs italic">"{vacationRecord.reason}"</p>
                            )}
                            <button
                                onClick={async () => { await onCancelVacation(vacationRecord); onClose(); }}
                                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <X className="w-4 h-4" /> Cancel This Leave
                            </button>
                        </div>
                    )}

                    {/* Dispute */}
                    {delivery && isPastDay && !alreadyDisputed && !disputeApproved && !disputeRejected && (
                        <div className="border-t border-white/10 pt-4">
                            {!showDispute ? (
                                <button
                                    onClick={() => setShowDispute(true)}
                                    className="w-full flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm py-2 transition-colors"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    Quantity incorrect? Raise a dispute
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-amber-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                                        <AlertTriangle className="w-3 h-3" /> What was actually delivered?
                                    </p>
                                    <ChipSelector options={QTY_OPTIONS.slice(0, -1)} selected={disputeQty} onChange={setDisputeQty} />
                                    <textarea
                                        value={disputeNote}
                                        onChange={(e) => setDisputeNote(e.target.value)}
                                        placeholder="Optional: describe the issue…"
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-white/20"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowDispute(false)} className="px-4 py-2 rounded-xl text-white/40 hover:text-white/70 text-sm">Cancel</button>
                                        <button
                                            onClick={handleDispute}
                                            disabled={disputeSaving || disputeDone}
                                            className="flex-1 py-2.5 font-semibold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                                            style={{ background: disputeDone ? "#22c55e" : "#f59e0b", color: "#000" }}
                                        >
                                            {disputeDone ? "Submitted ✓" :
                                                disputeSaving ? <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" /> :
                                                    "Submit Dispute"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Already disputed notice */}
                    {alreadyDisputed && (
                        <div className="border-t border-white/10 pt-4 flex items-center gap-2 text-amber-400 text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            Your dispute for {delivery?.client_quantity}L is awaiting admin review.
                            {delivery?.dispute_note && (
                                <span className="text-white/30 text-xs ml-1">"{delivery.dispute_note}"</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientDashboardPage() {
    const { userDoc, refreshUserDoc } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [deliveries, setDeliveries] = useState<DeliveryDoc[]>([]);
    const [vacations, setVacations] = useState<VacationDoc[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const monthKey = format(currentMonth, "yyyy-MM");

    const loadData = useCallback(async () => {
        if (!userDoc) return;
        const [dels, vacs, prods] = await Promise.all([
            getDeliveriesForClient(userDoc.uid, monthKey),
            getVacationsForClient(userDoc.uid),
            getProducts(),
        ]);
        setDeliveries(dels);
        setVacations(vacs);
        setProducts(prods);
    }, [userDoc, monthKey]);

    useEffect(() => { loadData(); }, [loadData]);

    // Only count confirmed deliveries in the client summary
    const confirmedDeliveries = deliveries.filter((d) => d.confirmed !== false);
    const monthTotal = confirmedDeliveries.reduce((sum, d) => sum + d.total_cost, 0);
    const monthLitres = confirmedDeliveries.reduce((sum, d) => sum + d.quantity, 0);
    const pendingCount = deliveries.filter((d) => d.confirmed === false).length;

    const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
    const selectedDelivery = selectedDate ? (deliveries.find((d) => d.date === selectedDateStr) ?? null) : null;
    const selectedVacationRecord = selectedDate
        ? (vacations.find((v) => selectedDateStr! >= v.start_date && selectedDateStr! <= v.end_date) ?? null)
        : null;

    const handleDaySelect = (date: Date) => {
        if (!isSameMonth(date, currentMonth)) setCurrentMonth(date);
        setSelectedDate(date);
    };

    const handleSaveEntry = async (type: string, qty: string) => {
        if (!userDoc || !selectedDate) return;
        const quantity = parseFloat(qty.replace("L", ""));
        const product = products.find((p) => p.name === type) ?? { id: "unknown", name: type as "Cow" | "Buffalo", price: 70 };
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        await logDelivery({
            client_uid: userDoc.uid,
            date: dateStr,
            product_id: product.id,
            product_name: type,
            quantity,
            total_cost: quantity * product.price,
        }, "client");
        await recalcInvoice(userDoc.uid, format(selectedDate, "yyyy-MM"));
        await loadData();
    };

    const handleDispute = async (deliveryId: string, claimedQty: number, note: string) => {
        await raiseDeliveryDispute(deliveryId, claimedQty, note);
        await loadData();
    };

    const handleSetDefault = async (type: string, qty: number, productId: string) => {
        if (!userDoc) return;
        await setClientDefault(userDoc.uid, productId, qty);
        await refreshUserDoc();
    };

    const handleCancelVacation = async (v: VacationDoc) => {
        if (!v.id) return;
        await deleteVacation(v.id);
        await loadData();
    };

    // Header default display — reads from fresh userDoc after refreshUserDoc
    const defaultTypeName = userDoc?.defaultProduct
        ? (products.find((p) => p.id === userDoc.defaultProduct)?.name ?? "Buffalo")
        : "Buffalo";
    const defaultQty = userDoc?.defaultQty ?? 1;
    const displayName = userDoc?.name ?? "Client";

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/20 rounded-2xl p-5">
                {/* Username greeting */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-300" />
                    </div>
                    <p className="text-white font-semibold text-sm">{displayName}</p>
                    {pendingCount > 0 && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {pendingCount} pending confirmation
                        </span>
                    )}
                </div>

                <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
                    {format(currentMonth, "MMMM yyyy")} — Confirmed
                </p>
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-3xl font-bold text-white">₹{monthTotal.toLocaleString("en-IN")}</p>
                        <p className="text-blue-300 text-sm mt-0.5 flex items-center gap-1">
                            <Milk className="w-3.5 h-3.5" /> {monthLitres.toFixed(1)}L confirmed
                        </p>
                    </div>
                    <div className="text-right">
                        <TrendingUp className="w-8 h-8 text-blue-400/40 ml-auto mb-1" />
                        <p className="text-white/30 text-xs">Default: {defaultQty.toFixed(1)}L {defaultTypeName}</p>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <CalendarView
                currentMonth={currentMonth}
                onPrevMonth={() => setCurrentMonth((m) => subMonths(m, 1))}
                onNextMonth={() => setCurrentMonth((m) => addMonths(m, 1))}
                deliveries={deliveries}
                vacations={vacations}
                onSelectDay={handleDaySelect}
                selectedDate={selectedDate ?? undefined}
            />

            <p className="text-center text-white/25 text-xs">
                🟢 Confirmed · 🟡 Pending · 🔴 Leave · Tap a date to update
            </p>

            {/* Day Panel */}
            {selectedDate && (
                <DayPanel
                    date={selectedDate}
                    delivery={selectedDelivery}
                    vacationRecord={selectedVacationRecord}
                    products={products}
                    userDoc={userDoc}
                    onSave={handleSaveEntry}
                    onDispute={handleDispute}
                    onSetDefault={handleSetDefault}
                    onCancelVacation={handleCancelVacation}
                    onClose={() => setSelectedDate(null)}
                />
            )}
        </div>
    );
}
