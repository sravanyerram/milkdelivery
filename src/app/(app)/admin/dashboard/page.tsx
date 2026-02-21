"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import {
    getTodayDeliveriesAdmin,
    getAllInvoices,
    getAllVacations,
    getDisputedDeliveries,
    resolveDeliveryDispute,
    getProducts,
    getAllUsers,
    InvoiceDoc,
    VacationDoc,
    DeliveryDoc,
    ProductDoc,
    UserDoc,
} from "@/lib/firestore";
import { Activity, Milk, TrendingUp, AlertCircle, Plus, CalendarDays, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
    const today = format(new Date(), "yyyy-MM-dd");
    const [todayLitres, setTodayLitres] = useState(0);
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [pendingInvoices, setPendingInvoices] = useState<InvoiceDoc[]>([]);
    const [vacations, setVacations] = useState<VacationDoc[]>([]);
    const [disputes, setDisputes] = useState<DeliveryDoc[]>([]);
    const [products, setProducts] = useState<ProductDoc[]>([]);
    const [clientsMap, setClientsMap] = useState<Record<string, UserDoc>>({});
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const [todayDels, invoices, vacs, disputed, prods, users] = await Promise.all([
            getTodayDeliveriesAdmin(today),
            getAllInvoices(),
            getAllVacations(),
            getDisputedDeliveries(),
            getProducts(),
            getAllUsers(),
        ]);
        setTodayLitres(todayDels.reduce((s, d) => s + d.quantity, 0));
        setTodayRevenue(todayDels.reduce((s, d) => s + d.total_cost, 0));
        setPendingInvoices(invoices.filter((i) => i.status === "Pending"));
        setVacations(vacs.filter((v) => today >= v.start_date && today <= v.end_date));
        setDisputes(disputed);
        setProducts(prods);
        const map: Record<string, UserDoc> = {};
        users.forEach((u) => { map[u.uid] = u; });
        setClientsMap(map);
        setLoading(false);
    }, [today]);

    useEffect(() => { load(); }, [load]);

    const handleResolve = async (delivery: DeliveryDoc, approve: boolean) => {
        setResolvingId(delivery.id ?? null);
        const product = products.find((p) => p.name === delivery.product_name);
        await resolveDeliveryDispute(delivery, approve, product?.price ?? 70);
        setResolvingId(null);
        load();
    };

    return (
        <div className="space-y-4">
            {/* Today Banner */}
            <div className="bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/20 rounded-2xl p-5">
                <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
                    Today — {format(new Date(), "dd MMM yyyy")}
                </p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <p className="text-3xl font-bold text-white">{todayLitres.toFixed(1)}L</p>
                        <p className="text-blue-300 text-sm flex items-center gap-1 mt-0.5">
                            <Milk className="w-3.5 h-3.5" /> Total Delivered
                        </p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white">₹{todayRevenue.toLocaleString("en-IN")}</p>
                        <p className="text-blue-300 text-sm flex items-center gap-1 mt-0.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Est. Revenue
                        </p>
                    </div>
                </div>
            </div>

            {/* Action Required */}
            {(pendingInvoices.length > 0) && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                    <p className="text-amber-400 text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> Action Required
                    </p>
                    <Link href="/admin/revenue" className="flex items-center justify-between hover:bg-white/5 rounded-xl p-2 transition-colors group">
                        <span className="text-white/70 text-sm">{pendingInvoices.length} Payment{pendingInvoices.length > 1 ? "s" : ""} Pending Confirmation</span>
                        <span className="text-amber-400 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                    </Link>
                </div>
            )}

            {/* Delivery Disputes */}
            {disputes.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3">
                    <p className="text-red-400 text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Delivery Disputes ({disputes.length})
                    </p>
                    {disputes.map((d) => {
                        const client = clientsMap[d.client_uid];
                        const isResolving = resolvingId === d.id;
                        return (
                            <div key={d.id} className="bg-white/5 rounded-xl p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-white font-medium text-sm">{client?.name ?? "Unknown Client"}</p>
                                        <p className="text-white/40 text-xs">{d.date} · Logged: {d.quantity}L · Claimed: {d.client_quantity}L</p>
                                        {d.dispute_note && (
                                            <p className="text-white/50 text-xs italic mt-0.5">"{d.dispute_note}"</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleResolve(d, true)}
                                        disabled={isResolving}
                                        className="flex-1 py-2 text-xs font-semibold rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {isResolving ? <div className="w-3 h-3 border-2 border-green-400/40 border-t-green-400 rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                        Approve ({d.client_quantity}L)
                                    </button>
                                    <button
                                        onClick={() => handleResolve(d, false)}
                                        disabled={isResolving}
                                        className="flex-1 py-2 text-xs font-semibold rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <CalendarDays className="w-5 h-5 text-purple-400 mb-2" />
                    <p className="text-2xl font-bold text-white">{vacations.length}</p>
                    <p className="text-white/50 text-xs mt-0.5">On Vacation Today</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <Activity className="w-5 h-5 text-green-400 mb-2" />
                    <p className="text-2xl font-bold text-white">{todayLitres > 0 ? "Active" : "Idle"}</p>
                    <p className="text-white/50 text-xs mt-0.5">Delivery Status</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Quick Actions</p>
                <Link href="/admin/clients" className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Plus className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">Log Delivery for Client</span>
                    <span className="ml-auto text-white/30 group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
                <Link href="/admin/users" className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">Manage Client Approvals</span>
                    <span className="ml-auto text-white/30 group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
                <Link href="/admin/revenue" className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">View Revenue & Payments</span>
                    <span className="ml-auto text-white/30 group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
            </div>

            {loading && (
                <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}
