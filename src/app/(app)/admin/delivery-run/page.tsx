"use client";

import { useState, useEffect, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
    getApprovedClients,
    getAllVacations,
    getTodayDeliveriesAdmin,
    getProducts,
    confirmDelivery,
    recalcInvoice,
    UserDoc,
    VacationDoc,
    DeliveryDoc,
    ProductDoc,
} from "@/lib/firestore";
import { ChipSelector } from "@/components/ui/ChipSelector";
import {
    Truck, CheckCircle, PlaneLanding, Milk,
    ChevronDown, ChevronUp, CalendarDays, Zap, Clock,
} from "lucide-react";

const QTY_OPTIONS = ["0.5L", "1.0L", "1.5L", "2.0L"];
const TYPE_OPTIONS = ["Buffalo", "Cow"];

interface ClientStatus {
    client: UserDoc;
    delivery: DeliveryDoc | null;
    onVacation: boolean;
}

function ClientRunRow({
    cs,
    products,
    selectedDate,
    onConfirmed,
}: {
    cs: ClientStatus;
    products: ProductDoc[];
    selectedDate: string;
    onConfirmed: () => void;
}) {
    const { client, delivery, onVacation } = cs;

    const defaultTypeName = client.defaultProduct
        ? (products.find((p) => p.id === client.defaultProduct)?.name ?? "Buffalo")
        : "Buffalo";

    const [open, setOpen] = useState(false);
    const [type, setType] = useState<string>(delivery?.product_name ?? defaultTypeName);
    const [qty, setQty] = useState<string>(
        delivery ? `${delivery.quantity.toFixed(1)}L`
            : client.defaultQty ? `${client.defaultQty.toFixed(1)}L`
                : "1.0L"
    );
    const [confirming, setConfirming] = useState(false);
    const [done, setDone] = useState(delivery?.confirmed === true);

    const isConfirmed = delivery?.confirmed === true || done;

    const handleConfirm = async () => {
        setConfirming(true);
        const product = products.find((p) => p.name === type) ?? products[0];
        const quantity = parseFloat(qty.replace("L", ""));
        const total_cost = quantity * (product?.price ?? 70);
        const month = selectedDate.slice(0, 7);

        await confirmDelivery({
            id: delivery?.id,
            client_uid: client.uid,
            date: selectedDate,
            product_id: product?.id ?? "",
            product_name: type,
            quantity,
            total_cost,
        });
        await recalcInvoice(client.uid, month);

        setConfirming(false);
        setDone(true);
        setOpen(false);
        onConfirmed();
    };

    if (onVacation) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-purple-500/5 border border-purple-500/15 rounded-2xl opacity-50">
                <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <PlaneLanding className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1">
                    <p className="text-white/60 text-sm font-medium">{client.name}</p>
                    <p className="text-white/30 text-xs">On vacation — skipped</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border transition-all ${isConfirmed
            ? "bg-green-500/8 border-green-500/20"
            : delivery
                ? "bg-amber-500/8 border-amber-500/20"
                : "bg-white/5 border-white/10"
            }`}>
            {/* Row header */}
            <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => !isConfirmed && setOpen((o) => !o)}
            >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${isConfirmed ? "bg-green-500/25 text-green-300" : "bg-white/10 text-white"}`}>
                    {isConfirmed
                        ? <CheckCircle className="w-4 h-4" />
                        : client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isConfirmed ? "text-green-300" : "text-white"}`}>
                        {client.name}
                    </p>
                    <p className="text-white/35 text-xs">
                        {isConfirmed
                            ? `✅ Confirmed · ${type} · ${qty}`
                            : delivery
                                ? `📬 Client requested ${delivery.quantity.toFixed(1)}L ${delivery.product_name}`
                                : `📋 Default: ${client.defaultQty ?? 1}L ${defaultTypeName}`}
                    </p>
                </div>
                {!isConfirmed && (
                    open
                        ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
                )}
            </button>

            {/* Expanded confirm form */}
            {open && !isConfirmed && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
                    <p className="text-white/40 text-xs uppercase tracking-wider">Adjust if needed, then confirm</p>
                    <div className="space-y-2">
                        <p className="text-white/50 text-xs">Milk Type</p>
                        <ChipSelector
                            options={TYPE_OPTIONS}
                            selected={type}
                            onChange={setType}
                        />
                    </div>
                    <div className="space-y-2">
                        <p className="text-white/50 text-xs">Quantity</p>
                        <ChipSelector
                            options={QTY_OPTIONS}
                            selected={qty}
                            onChange={setQty}
                        />
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={confirming}
                        className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                    >
                        {confirming
                            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <><CheckCircle className="w-4 h-4" /> Confirm Delivered</>}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function DeliveryRunPage() {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [statuses, setStatuses] = useState<ClientStatus[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmingAll, setConfirmingAll] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [clients, vacations, deliveries, prods] = await Promise.all([
            getApprovedClients(),
            getAllVacations(),
            getTodayDeliveriesAdmin(selectedDate),
            getProducts(),
        ]);
        setProducts(prods);

        const result: ClientStatus[] = clients
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((client) => ({
                client,
                delivery: deliveries.find((d: DeliveryDoc) => d.client_uid === client.uid) ?? null,
                onVacation: vacations.some(
                    (v: VacationDoc) => v.client_uid === client.uid
                        && selectedDate >= v.start_date
                        && selectedDate <= v.end_date
                ),
            }));

        setStatuses(result);
        setLoading(false);
    }, [selectedDate]);

    useEffect(() => { load(); }, [load]);

    const confirmed = statuses.filter((s) => !s.onVacation && s.delivery?.confirmed === true);
    const pending = statuses.filter((s) => !s.onVacation && s.delivery?.confirmed !== true);
    const onVacation = statuses.filter((s) => s.onVacation);
    const total = statuses.filter((s) => !s.onVacation).length;
    const progress = total > 0 ? (confirmed.length / total) * 100 : 0;
    const allDone = total > 0 && confirmed.length === total;

    const handleConfirmAll = async () => {
        setConfirmingAll(true);
        await Promise.all(
            pending.map(async (s) => {
                const client = s.client;
                const defaultTypeName = client.defaultProduct
                    ? (products.find((p) => p.id === client.defaultProduct)?.name ?? "Buffalo")
                    : "Buffalo";
                const quantity = s.delivery?.quantity ?? client.defaultQty ?? 1;
                const type = s.delivery?.product_name ?? defaultTypeName;
                const product = products.find((p) => p.name === type) ?? products[0];
                const total_cost = quantity * (product?.price ?? 70);
                const month = selectedDate.slice(0, 7);
                await confirmDelivery({
                    id: s.delivery?.id,
                    client_uid: client.uid,
                    date: selectedDate,
                    product_id: product?.id ?? "",
                    product_name: type,
                    quantity,
                    total_cost,
                });
                await recalcInvoice(client.uid, month);
            })
        );
        setConfirmingAll(false);
        await load();
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-br from-green-600/30 to-emerald-600/20 border border-green-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <Truck className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg">Delivery Run</h1>
                        <p className="text-green-300 text-sm flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(), "EEEE, d MMMM")}
                        </p>
                    </div>
                </div>

                {/* Date picker */}
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <CalendarDays className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="flex-1 bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
                    />
                </div>

                {/* Progress */}
                {!loading && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">
                                <span className="text-white font-bold">{confirmed.length}</span> / {total} confirmed
                            </span>
                            {onVacation.length > 0 && (
                                <span className="text-purple-300 text-xs">✈️ {onVacation.length} on vacation</span>
                            )}
                        </div>
                        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        {allDone && (
                            <p className="text-green-400 text-xs font-semibold text-center">
                                🎉 All deliveries confirmed for this date!
                            </p>
                        )}
                    </div>
                )}

                {/* Confirm All button */}
                {!loading && pending.length > 0 && (
                    <button
                        onClick={handleConfirmAll}
                        disabled={confirmingAll}
                        className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                    >
                        {confirmingAll
                            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Confirming all…</>
                            : <><Zap className="w-4 h-4" /> Confirm All ({pending.length} remaining)</>}
                    </button>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                    {statuses.length === 0 && (
                        <div className="text-center py-12">
                            <Milk className="w-10 h-10 text-white/10 mx-auto mb-2" />
                            <p className="text-white/30 text-sm">No approved clients found.</p>
                        </div>
                    )}
                    {/* Pending first, then confirmed, then vacation */}
                    {[...pending, ...confirmed, ...onVacation].map((cs) => (
                        <ClientRunRow
                            key={cs.client.uid}
                            cs={cs}
                            products={products}
                            selectedDate={selectedDate}
                            onConfirmed={load}
                        />
                    ))}
                </div>
            )}

            {/* Legend */}
            {!loading && statuses.length > 0 && (
                <div className="flex gap-3 text-xs text-white/30 flex-wrap justify-center pb-2">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Client requested</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/20" /> Using default</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Confirmed</span>
                </div>
            )}
        </div>
    );
}
