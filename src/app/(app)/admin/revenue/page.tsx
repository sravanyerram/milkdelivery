"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getAllInvoices,
    getAllUsers,
    updateInvoiceStatus,
    InvoiceDoc,
    UserDoc,
} from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format, parse } from "date-fns";
import { addMonths, subMonths } from "date-fns";
import { TrendingUp, ChevronLeft, ChevronRight, CheckCircle, MessageCircle, IndianRupee } from "lucide-react";

export default function AdminRevenuePage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState<string | null>(null);

    const monthKey = format(currentMonth, "yyyy-MM");

    const load = useCallback(async () => {
        const [invs, usrs] = await Promise.all([getAllInvoices(), getAllUsers()]);
        setInvoices(invs);
        setUsers(usrs);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const monthInvoices = invoices.filter((i) => i.month_year === monthKey);

    const collected = monthInvoices
        .filter((i) => i.status === "Confirmed")
        .reduce((s, i) => s + i.total_amount, 0);
    const outstanding = monthInvoices
        .filter((i) => i.status !== "Confirmed")
        .reduce((s, i) => s + i.total_amount, 0);

    const pendingConf = monthInvoices.filter((i) => i.status === "Pending");
    const unpaid = monthInvoices.filter((i) => i.status === "Unpaid");

    const userName = (uid: string) =>
        users.find((u) => u.uid === uid)?.name ?? uid.substring(0, 8) + "…";

    const handleConfirm = async (inv: InvoiceDoc) => {
        if (!inv.id) return;
        setActioning(inv.id);
        await updateInvoiceStatus(inv.id, "Confirmed");
        await load();
        setActioning(null);
    };

    const monthLabel = format(currentMonth, "MMMM yyyy");

    const whatsappReminder = (inv: InvoiceDoc) => {
        const name = userName(inv.client_uid);
        const msg = `Hi ${name}, just a reminder that your milk bill for ${monthLabel} is ₹${inv.total_amount.toLocaleString("en-IN")} and is unpaid. Please settle it at your earliest. 🥛`;
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
                        <h1 className="text-white font-bold">Revenue: {monthLabel}</h1>
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

            {/* Pending Confirmation */}
            {pendingConf.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-amber-400 text-xs uppercase tracking-wider font-semibold">
                            Pending Vendor Confirmation ({pendingConf.length})
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {pendingConf.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between p-4">
                                <div>
                                    <p className="text-white font-medium text-sm">{userName(inv.client_uid)}</p>
                                    <p className="text-white/50 text-xs">₹{inv.total_amount.toLocaleString("en-IN")} · Client marked as paid</p>
                                </div>
                                <button
                                    id={`confirm-receipt-${inv.id}`}
                                    onClick={() => handleConfirm(inv)}
                                    disabled={actioning === inv.id}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {actioning === inv.id
                                        ? <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                                        : <CheckCircle className="w-3.5 h-3.5" />}
                                    Confirm Receipt
                                </button>
                            </div>
                        ))}
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
                        {unpaid.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between p-4">
                                <div>
                                    <p className="text-white font-medium text-sm">{userName(inv.client_uid)}</p>
                                    <p className="text-white/50 text-xs">₹{inv.total_amount.toLocaleString("en-IN")}</p>
                                </div>
                                <a
                                    href={whatsappReminder(inv)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-semibold rounded-xl transition-all"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" /> Send Reminder
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All settled */}
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
