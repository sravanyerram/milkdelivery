"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getAllInvoices,
    getAllUsers,
    recordPayment,
    declinePayment,
    updateInvoiceStatus,
    InvoiceDoc,
    UserDoc,
} from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format, parse } from "date-fns";
import { addMonths, subMonths } from "date-fns";
import {
    TrendingUp, ChevronLeft, ChevronRight, CheckCircle,
    MessageCircle, IndianRupee, XCircle, ChevronDown,
} from "lucide-react";

export default function AdminRevenuePage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [confirmAmount, setConfirmAmount] = useState<Record<string, string>>({});

    const monthKey = format(currentMonth, "yyyy-MM");

    const load = useCallback(async () => {
        const [invs, usrs] = await Promise.all([getAllInvoices(), getAllUsers()]);
        setInvoices(invs);
        setUsers(usrs);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const monthInvoices = invoices.filter((i) => i.month_year === monthKey);

    // Use amount_paid for collected; outstanding = total - paid (for all non-fully-paid)
    const collected = monthInvoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
    const outstanding = monthInvoices.reduce(
        (s, i) => s + Math.max(0, i.total_amount - (i.amount_paid ?? 0)),
        0
    );

    const pendingConf = monthInvoices.filter((i) => i.status === "Pending");
    const unpaid = monthInvoices.filter((i) => i.status === "Unpaid");

    const userName = (uid: string) =>
        users.find((u) => u.uid === uid)?.name ?? uid.substring(0, 8) + "…";

    const handleConfirm = async (inv: InvoiceDoc) => {
        if (!inv.id) return;
        setActioning(inv.id);
        const amount = parseFloat(confirmAmount[inv.id] ?? String(inv.total_amount - (inv.amount_paid ?? 0)));
        if (isNaN(amount) || amount <= 0) { setActioning(null); return; }
        await recordPayment(inv.id, amount);
        setConfirmingId(null);
        await load();
        setActioning(null);
    };

    const handleDecline = async (inv: InvoiceDoc) => {
        if (!inv.id) return;
        setActioning(inv.id + "-decline");
        await declinePayment(inv.id);
        await load();
        setActioning(null);
    };

    const monthLabel = format(currentMonth, "MMMM yyyy");

    const whatsappReminder = (inv: InvoiceDoc) => {
        const name = userName(inv.client_uid);
        const outstanding = inv.total_amount - (inv.amount_paid ?? 0);
        const msg = `Hi ${name}, your milk bill for ${monthLabel} is ₹${inv.total_amount.toLocaleString("en-IN")}. Outstanding: ₹${outstanding.toLocaleString("en-IN")}. Please settle at your earliest. 🥛`;
        return `https://wa.me/?text=${encodeURIComponent(msg)}`;
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-br from-green-600/30 to-emerald-600/20 border border-green-500/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <ChevronLeft className="w-5 h-5 text-white/70" />
                    </button>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <h1 className="text-white font-bold">Finance: {monthLabel}</h1>
                    </div>
                    <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <ChevronRight className="w-5 h-5 text-white/70" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                        <p className="text-green-300/70 text-xs uppercase tracking-wider mb-1">Collected</p>
                        <p className="text-green-300 font-bold text-xl">₹{collected.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <p className="text-red-300/70 text-xs uppercase tracking-wider mb-1">Outstanding</p>
                        <p className="text-red-300 font-bold text-xl">₹{outstanding.toLocaleString("en-IN")}</p>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Pending Payment Confirmations */}
            {pendingConf.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-amber-400 text-xs uppercase tracking-wider font-semibold">
                            Pending Confirmation ({pendingConf.length})
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {pendingConf.map((inv) => {
                            const remaining = inv.total_amount - (inv.amount_paid ?? 0);
                            const isExpanded = confirmingId === inv.id;
                            return (
                                <div key={inv.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-white font-medium text-sm">{userName(inv.client_uid)}</p>
                                            <p className="text-white/50 text-xs">
                                                Bill: ₹{inv.total_amount.toLocaleString("en-IN")}
                                                {(inv.amount_paid ?? 0) > 0 && (
                                                    <span className="text-green-400 ml-1">
                                                        · Paid: ₹{(inv.amount_paid ?? 0).toLocaleString("en-IN")}
                                                        · Due: ₹{remaining.toLocaleString("en-IN")}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-amber-400/70 text-xs mt-0.5">Client marked as paid</p>
                                        </div>
                                        <button
                                            onClick={() => setConfirmingId(isExpanded ? null : inv.id ?? null)}
                                            className="p-1.5 text-white/30 hover:text-white/60"
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="space-y-2 pt-1">
                                            <p className="text-white/40 text-xs">Amount received (default: full outstanding)</p>
                                            <input
                                                type="number"
                                                value={confirmAmount[inv.id ?? ""] ?? String(remaining)}
                                                onChange={(e) => setConfirmAmount((p) => ({ ...p, [inv.id ?? ""]: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                placeholder={String(remaining)}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    id={`confirm-receipt-${inv.id}`}
                                                    onClick={() => handleConfirm(inv)}
                                                    disabled={actioning === inv.id}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                                                >
                                                    {actioning === inv.id
                                                        ? <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                                                        : <CheckCircle className="w-3.5 h-3.5" />}
                                                    Confirm Receipt
                                                </button>
                                                <button
                                                    onClick={() => handleDecline(inv)}
                                                    disabled={actioning === inv.id + "-decline"}
                                                    className="flex items-center gap-1.5 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                                                >
                                                    {actioning === inv.id + "-decline"
                                                        ? <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                                        : <XCircle className="w-3.5 h-3.5" />}
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Unpaid Bills */}
            {unpaid.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-red-400 text-xs uppercase tracking-wider font-semibold">
                            Unpaid Bills ({unpaid.length})
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {unpaid.map((inv) => {
                            const remaining = inv.total_amount - (inv.amount_paid ?? 0);
                            return (
                                <div key={inv.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <p className="text-white font-medium text-sm">{userName(inv.client_uid)}</p>
                                        <p className="text-white/50 text-xs">
                                            Bill: ₹{inv.total_amount.toLocaleString("en-IN")}
                                            {(inv.amount_paid ?? 0) > 0 && (
                                                <span className="text-amber-400 ml-1">
                                                    · Paid: ₹{(inv.amount_paid ?? 0).toLocaleString("en-IN")}
                                                    · Due: ₹{remaining.toLocaleString("en-IN")}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <a
                                        href={whatsappReminder(inv)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-semibold rounded-xl transition-all"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" /> Remind
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && monthInvoices.length === 0 && (
                <div className="text-center py-12 text-white/30">
                    <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No invoices for {monthLabel}.</p>
                </div>
            )}

            {!loading && monthInvoices.length > 0 && pendingConf.length === 0 && unpaid.length === 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <p className="text-green-300 font-semibold">All payments confirmed for {monthLabel}! 🎉</p>
                </div>
            )}
        </div>
    );
}
