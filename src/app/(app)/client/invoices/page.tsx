"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    getInvoicesForClient,
    updateInvoiceStatus,
    addDisputeNote,
    InvoiceDoc,
} from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format, parse } from "date-fns";
import { FileText, MessageCircle, Send, ChevronDown, ChevronUp } from "lucide-react";

function InvoiceCard({ inv, onRefresh, userName }: { inv: InvoiceDoc; onRefresh: () => void; userName: string }) {
    const [expanded, setExpanded] = useState(false);
    const [disputeMsg, setDisputeMsg] = useState("");
    const [loading, setLoading] = useState(false);

    const monthLabel = (() => {
        try { return format(parse(inv.month_year, "yyyy-MM", new Date()), "MMMM yyyy"); }
        catch { return inv.month_year; }
    })();

    const handleMarkPaid = async () => {
        if (!inv.id) return;
        setLoading(true);
        await updateInvoiceStatus(inv.id, "Pending");
        onRefresh();
        setLoading(false);
    };

    const handleSendNote = async () => {
        if (!inv.id || !disputeMsg.trim()) return;
        setLoading(true);
        await addDisputeNote(inv.id, {
            author: "Client",
            message: disputeMsg.trim(),
            timestamp: new Date().toISOString(),
        }, inv.dispute_notes ?? []);
        setDisputeMsg("");
        onRefresh();
        setLoading(false);
    };

    return (
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between p-4">
                <div>
                    <p className="text-white font-semibold">{monthLabel}</p>
                    <p className="text-white/50 text-sm">
                        Bill: ₹{inv.total_amount.toLocaleString("en-IN")}
                    </p>
                    {(inv.amount_paid ?? 0) > 0 && inv.status !== "Confirmed" && (
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-green-400 text-xs">
                                ✓ Paid: ₹{(inv.amount_paid ?? 0).toLocaleString("en-IN")}
                            </span>
                            <span className="text-red-400 text-xs">
                                Due: ₹{(inv.total_amount - (inv.amount_paid ?? 0)).toLocaleString("en-IN")}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={inv.status} />
                    <button onClick={() => setExpanded((e) => !e)} className="p-2 text-white/40 hover:text-white/70">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Actions */}
            {inv.status === "Unpaid" && (
                <div className="px-4 pb-4">
                    <button
                        id={`mark-paid-${inv.id}`}
                        onClick={handleMarkPaid}
                        disabled={loading}
                        className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-semibold rounded-xl transition-all duration-200 active:scale-95 text-sm flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" /> : null}
                        Mark as Paid (Handshake)
                    </button>
                </div>
            )}
            {inv.status === "Pending" && (
                <div className="px-4 pb-4">
                    <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                        ⏳ Awaiting vendor confirmation…
                    </div>
                </div>
            )}

            {/* Expanded: Disputes */}
            {expanded && (
                <div className="border-t border-white/10 p-4 space-y-3">
                    <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5" /> Disputes & Questions
                    </p>

                    {/* Chat thread */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(inv.dispute_notes ?? []).length === 0 && (
                            <p className="text-white/30 text-sm">No messages yet.</p>
                        )}
                        {(inv.dispute_notes ?? []).map((note, i) => (
                            <div
                                key={i}
                                className={`flex ${note.author === "Client" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${note.author === "Client"
                                    ? "bg-blue-500/20 text-blue-200"
                                    : "bg-white/10 text-white/70"
                                    }`}>
                                    <p className="text-xs opacity-60 mb-0.5">{note.author}</p>
                                    {note.message}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Send message */}
                    <div className="flex gap-2">
                        <input
                            value={disputeMsg}
                            onChange={(e) => setDisputeMsg(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendNote()}
                            placeholder="Type a message…"
                            className="flex-1 bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/20"
                        />
                        <button
                            onClick={handleSendNote}
                            disabled={loading || !disputeMsg.trim()}
                            className="p-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white rounded-xl transition-all"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ClientInvoicesPage() {
    const { userDoc } = useAuth();
    const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
    const [loading, setLoading] = useState(true);

    const loadInvoices = useCallback(async () => {
        if (!userDoc) return;
        const data = await getInvoicesForClient(userDoc.uid);
        setInvoices(data);
        setLoading(false);
    }, [userDoc]);

    useEffect(() => { loadInvoices(); }, [loadInvoices]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg">My Invoices</h1>
                        <p className="text-indigo-300 text-sm">Billing & payment history</p>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {!loading && invoices.length === 0 && (
                <div className="text-center py-12 text-white/30">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No invoices yet. Deliveries will appear here.</p>
                </div>
            )}

            {invoices.map((inv) => (
                <InvoiceCard
                    key={inv.id}
                    inv={inv}
                    onRefresh={loadInvoices}
                    userName={userDoc?.name ?? "Client"}
                />
            ))}
        </div>
    );
}
