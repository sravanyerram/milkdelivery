"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getApprovedClients,
    getAllVacations,
    getTodayDeliveriesAdmin,
    logDelivery,
    getProducts,
    recalcInvoice,
    saveVacation,
    deleteVacation,
    setClientDefault,
    UserDoc,
    VacationDoc,
    DeliveryDoc,
    ProductDoc,
} from "@/lib/firestore";
import { ChipSelector } from "@/components/ui/ChipSelector";
import { format } from "date-fns";
import {
    Search, Milk, CheckCircle, PlaneLanding,
    ChevronDown, ChevronUp, CalendarDays, Zap,
    Trash2, Plus, Settings2, BookmarkCheck,
} from "lucide-react";

const QTY_OPTIONS = ["0.5L", "1.0L", "1.5L", "2.0L"];
const TYPE_OPTIONS = ["Buffalo", "Cow"];

// ── Per-client row ─────────────────────────────────────────────────────────────

function ClientRow({
    client,
    clientVacations,
    existingDelivery,
    products,
    selectedDate,
    onLogged,
}: {
    client: UserDoc;
    clientVacations: VacationDoc[];
    existingDelivery: DeliveryDoc | null;
    products: ProductDoc[];
    selectedDate: string;
    onLogged: () => void;
}) {
    const defaultTypeName = client.defaultProduct
        ? (products.find((p) => p.id === client.defaultProduct)?.name ?? "Buffalo")
        : "Buffalo";

    const isOnVacationForDate = clientVacations.some(
        (v) => selectedDate >= v.start_date && selectedDate <= v.end_date
    );

    // Log section
    const [logOpen, setLogOpen] = useState(false);
    const [type, setType] = useState<string>(existingDelivery?.product_name ?? defaultTypeName);
    const [qty, setQty] = useState<string>(
        existingDelivery ? `${existingDelivery.quantity.toFixed(1)}L`
            : client.defaultQty ? `${client.defaultQty.toFixed(1)}L`
                : "1.0L"
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Vacation section
    const [vacOpen, setVacOpen] = useState(false);
    const [vacStart, setVacStart] = useState(format(new Date(), "yyyy-MM-dd"));
    const [vacEnd, setVacEnd] = useState(format(new Date(), "yyyy-MM-dd"));
    const [vacSaving, setVacSaving] = useState(false);

    // Default section
    const [defaultOpen, setDefaultOpen] = useState(false);
    const [defType, setDefType] = useState<string>(defaultTypeName);
    const [defQty, setDefQty] = useState<string>(client.defaultQty ? `${client.defaultQty}L` : "1.0L");
    const [defSaving, setDefSaving] = useState(false);
    const [defSaved, setDefSaved] = useState(false);

    useEffect(() => {
        setType(existingDelivery?.product_name ?? defaultTypeName);
        setQty(existingDelivery ? `${existingDelivery.quantity.toFixed(1)}L` : client.defaultQty ? `${client.defaultQty.toFixed(1)}L` : "1.0L");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingDelivery, selectedDate]);

    const handleLog = async () => {
        setSaving(true);
        const product = products.find((p) => p.name === type) ?? products[0];
        const quantity = parseFloat(qty.replace("L", ""));
        const total_cost = quantity * (product?.price ?? 70);
        const month = selectedDate.slice(0, 7);
        await logDelivery({
            client_uid: client.uid,
            date: selectedDate,
            product_id: product?.id ?? "",
            product_name: type,
            quantity,
            total_cost,
        }, "admin");
        await recalcInvoice(client.uid, month);
        setSaved(true);
        setTimeout(() => { setSaved(false); onLogged(); }, 1200);
        setSaving(false);
        setLogOpen(false);
    };

    const handleSaveVacation = async () => {
        setVacSaving(true);
        await saveVacation({ client_uid: client.uid, start_date: vacStart, end_date: vacEnd });
        setVacSaving(false);
        setVacOpen(false);
        onLogged(); // refresh parent
    };

    const handleDeleteVacation = async (v: VacationDoc) => {
        if (!v.id) return;
        await deleteVacation(v.id);
        onLogged();
    };

    const handleSaveDefault = async () => {
        setDefSaving(true);
        const product = products.find((p) => p.name === defType);
        const qty_num = parseFloat(defQty.replace("L", ""));
        await setClientDefault(client.uid, product?.id ?? "", qty_num);
        setDefSaving(false);
        setDefSaved(true);
        setTimeout(() => setDefSaved(false), 1500);
        onLogged();
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {/* Main row */}
            <div className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{client.name}</p>
                    <p className="text-white/35 text-xs truncate">
                        {defaultTypeName} · {client.defaultQty ?? 1}L default
                        {isOnVacationForDate && " · 🏖️ Vacation"}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Default settings */}
                    <button
                        onClick={() => { setDefaultOpen((o) => !o); setLogOpen(false); setVacOpen(false); }}
                        title="Set default"
                        className="p-2 rounded-xl hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
                    {/* Vacation */}
                    <button
                        onClick={() => { setVacOpen((o) => !o); setLogOpen(false); setDefaultOpen(false); }}
                        title="Set vacation"
                        className={`p-2 rounded-xl transition-colors ${isOnVacationForDate ? "bg-purple-500/20 text-purple-400" : "hover:bg-white/10 text-white/30 hover:text-white/60"}`}
                    >
                        <PlaneLanding className="w-4 h-4" />
                    </button>
                    {/* Log */}
                    {isOnVacationForDate ? (
                        <span className="text-xs px-2 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">Vacation</span>
                    ) : existingDelivery ? (
                        <button
                            onClick={() => { setLogOpen((o) => !o); setVacOpen(false); setDefaultOpen(false); }}
                            className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1.5 rounded-xl hover:bg-green-500/20 transition-colors"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {existingDelivery.quantity}L {logOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    ) : (
                        <>
                            {saved && <CheckCircle className="w-5 h-5 text-green-400" />}
                            <button
                                onClick={() => { setLogOpen((o) => !o); setVacOpen(false); setDefaultOpen(false); }}
                                className="text-xs px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl transition-all font-medium flex items-center gap-1"
                            >
                                Log {logOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Log panel */}
            {logOpen && (
                <div className="border-t border-white/10 p-4 space-y-3 bg-blue-950/30">
                    <p className="text-white/40 text-xs">{existingDelivery ? "Override entry:" : "Log entry:"}</p>
                    <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                            <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wider">Type</p>
                            <ChipSelector options={TYPE_OPTIONS} selected={type} onChange={setType} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wider">Qty</p>
                            <ChipSelector options={QTY_OPTIONS} selected={qty} onChange={setQty} />
                        </div>
                    </div>
                    <button
                        onClick={handleLog}
                        disabled={saving}
                        className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Milk className="w-4 h-4" />}
                        {saving ? "Logging…" : existingDelivery ? "Update" : "Confirm Log"}
                    </button>
                </div>
            )}

            {/* Default settings panel */}
            {defaultOpen && (
                <div className="border-t border-white/10 p-4 space-y-3 bg-indigo-950/30">
                    <p className="text-white/40 text-xs uppercase tracking-wider">Set Daily Default for {client.name}</p>
                    <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                            <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wider">Type</p>
                            <ChipSelector options={TYPE_OPTIONS} selected={defType} onChange={setDefType} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wider">Qty</p>
                            <ChipSelector options={QTY_OPTIONS} selected={defQty} onChange={setDefQty} />
                        </div>
                    </div>
                    <button
                        onClick={handleSaveDefault}
                        disabled={defSaving || defSaved}
                        className="w-full py-2.5 font-semibold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                        style={{ background: defSaved ? "#22c55e" : "#6366f1", color: "#fff" }}
                    >
                        {defSaved ? <><BookmarkCheck className="w-4 h-4" /> Default Saved!</> :
                            defSaving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> :
                                <><Settings2 className="w-4 h-4" /> Save as Default</>}
                    </button>
                </div>
            )}

            {/* Vacation panel */}
            {vacOpen && (
                <div className="border-t border-white/10 p-4 space-y-3 bg-purple-950/30">
                    <p className="text-white/40 text-xs uppercase tracking-wider">Vacation / Pause for {client.name}</p>

                    {/* Existing vacations */}
                    {clientVacations.length > 0 && (
                        <div className="space-y-1.5">
                            {clientVacations.map((v) => (
                                <div key={v.id} className="flex items-center justify-between text-xs text-white/60 bg-white/5 rounded-lg px-3 py-2">
                                    <span>{v.start_date} → {v.end_date}</span>
                                    <button onClick={() => handleDeleteVacation(v)} className="text-red-400 hover:text-red-300 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* New vacation */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">From</p>
                            <input
                                type="date"
                                value={vacStart}
                                onChange={(e) => setVacStart(e.target.value)}
                                className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                        <div>
                            <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">To</p>
                            <input
                                type="date"
                                value={vacEnd}
                                onChange={(e) => setVacEnd(e.target.value)}
                                className="w-full bg-white/10 text-white border border-white/20 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSaveVacation}
                        disabled={vacSaving}
                        className="w-full py-2.5 bg-purple-500/30 hover:bg-purple-500/40 border border-purple-500/40 text-purple-300 font-semibold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {vacSaving ? <div className="w-4 h-4 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" /> :
                            <><Plus className="w-4 h-4" /> Set Vacation</>}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminClientsPage() {
    const [clients, setClients] = useState<UserDoc[]>([]);
    const [vacations, setVacations] = useState<VacationDoc[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [deliveriesForDate, setDeliveriesForDate] = useState<DeliveryDoc[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [bulkLogging, setBulkLogging] = useState(false);
    const [bulkDone, setBulkDone] = useState(false);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

    const load = useCallback(async () => {
        setLoading(true);
        const [cls, vacs, prods, dels] = await Promise.all([
            getApprovedClients(),
            getAllVacations(),
            getProducts(),
            getTodayDeliveriesAdmin(selectedDate),
        ]);
        setClients(cls.sort((a, b) => a.name.localeCompare(b.name)));
        setVacations(vacs);
        setProducts(prods);
        setDeliveriesForDate(dels);
        setLoading(false);
    }, [selectedDate]);

    useEffect(() => { load(); }, [load]);

    const isOnVacation = (uid: string) =>
        vacations.some((v) => v.client_uid === uid && selectedDate >= v.start_date && selectedDate <= v.end_date);

    const getClientVacations = (uid: string) => vacations.filter((v) => v.client_uid === uid);

    const getExistingDelivery = (uid: string) =>
        deliveriesForDate.find((d) => d.client_uid === uid) ?? null;

    const filteredClients = clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    const toLogCount = clients.filter((c) => !isOnVacation(c.uid) && !getExistingDelivery(c.uid)).length;
    const loggedCount = clients.filter((c) => !!getExistingDelivery(c.uid)).length;

    const handleLogAll = async () => {
        setBulkLogging(true);
        const month = selectedDate.slice(0, 7);
        const pending = clients.filter((c) => !isOnVacation(c.uid) && !getExistingDelivery(c.uid));
        await Promise.all(pending.map(async (client) => {
            const defaultTypeName = client.defaultProduct
                ? (products.find((p) => p.id === client.defaultProduct)?.name ?? "Buffalo")
                : "Buffalo";
            const quantity = client.defaultQty ?? 1;
            const product = products.find((p) => p.name === defaultTypeName) ?? products[0];
            const total_cost = quantity * (product?.price ?? 70);
            await logDelivery({
                client_uid: client.uid,
                date: selectedDate,
                product_id: product?.id ?? "",
                product_name: defaultTypeName,
                quantity,
                total_cost,
            }, "admin");
            await recalcInvoice(client.uid, month);
        }));
        setBulkLogging(false);
        setBulkDone(true);
        setTimeout(() => { setBulkDone(false); load(); }, 1500);
    };

    return (
        <div className="space-y-4">
            {/* Header card */}
            <div className="bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <Milk className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg">Client Directory</h1>
                        <p className="text-blue-300 text-sm">
                            {loggedCount}/{clients.length} logged · {toLogCount} remaining
                        </p>
                    </div>
                </div>

                {/* Date picker */}
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-300 flex-shrink-0" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { setSelectedDate(e.target.value); setBulkDone(false); }}
                        className="flex-1 bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>

                {/* Log All */}
                <button
                    onClick={handleLogAll}
                    disabled={bulkLogging || bulkDone || toLogCount === 0}
                    className="w-full py-3 font-bold text-white rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
                    style={{ background: bulkDone ? "#22c55e" : "#3b82f6" }}
                >
                    {bulkDone ? <><CheckCircle className="w-5 h-5" /> All Logged!</> :
                        bulkLogging ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Logging all…</> :
                            <><Zap className="w-5 h-5" /> Log All Defaults ({toLogCount} clients)</>}
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                    id="client-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search client name or email…"
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/20 text-sm"
                />
            </div>

            <p className="text-white/25 text-xs text-center">
                ⚙️ = Set default · ✈️ = Set vacation · Tap Log to override
            </p>

            {loading && (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Client rows */}
            <div className="space-y-2">
                {filteredClients.map((client) => (
                    <ClientRow
                        key={client.uid}
                        client={client}
                        clientVacations={getClientVacations(client.uid)}
                        existingDelivery={getExistingDelivery(client.uid)}
                        products={products}
                        selectedDate={selectedDate}
                        onLogged={load}
                    />
                ))}
                {!loading && filteredClients.length === 0 && (
                    <p className="text-center text-white/30 py-8">No clients found.</p>
                )}
            </div>
        </div>
    );
}
