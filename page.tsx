"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllUsers, updateUser, UserDoc } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Users, CheckCircle, XCircle, ExternalLink } from "lucide-react";

function UserRow({ user, onAction }: { user: UserDoc; onAction: () => void }) {
    const [loading, setLoading] = useState(false);

    const handle = async (status: "Approved" | "Rejected") => {
        setLoading(true);
        await updateUser(user.uid, { status });
        onAction();
        setLoading(false);
    };

    return (
        <div className="flex items-start gap-3 p-4 hover:bg-white/5 rounded-xl transition-colors">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{user.name}</p>
                <p className="text-white/40 text-xs truncate">{user.email}</p>
                <p className="text-white/30 text-xs mt-0.5">{user.createdAt ? "Requested recently" : "New user"}</p>
            </div>
            {user.status === "Pending" && (
                <div className="flex gap-2">
                    <button
                        id={`approve-${user.uid}`}
                        onClick={() => handle("Approved")}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                        {loading ? <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Approve
                    </button>
                    <button
                        id={`reject-${user.uid}`}
                        onClick={() => handle("Rejected")}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                    >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                </div>
            )}
            {user.status !== "Pending" && (
                <StatusBadge status={user.status} />
            )}
        </div>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const all = await getAllUsers();
        setUsers(all.sort((a, b) => {
            // Pending first
            if (a.status === "Pending" && b.status !== "Pending") return -1;
            if (b.status === "Pending" && a.status !== "Pending") return 1;
            return a.name.localeCompare(b.name);
        }));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const pending = users.filter((u) => u.status === "Pending" && u.role === "Client");
    const active = users.filter((u) => u.status === "Approved" && u.role === "Client");

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg">Manage Clients</h1>
                        <p className="text-indigo-300 text-sm">{active.length} active · {pending.length} pending</p>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Pending */}
            {pending.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-amber-400 text-xs uppercase tracking-wider font-semibold">
                            Pending Approval ({pending.length})
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {pending.map((u) => <UserRow key={u.uid} user={u} onAction={load} />)}
                    </div>
                </div>
            )}

            {/* Active */}
            {active.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl">
                    <div className="p-4 border-b border-white/5">
                        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
                            Active Clients ({active.length})
                        </p>
                    </div>
                    <div className="divide-y divide-white/5">
                        {active.map((u) => <UserRow key={u.uid} user={u} onAction={load} />)}
                    </div>
                </div>
            )}

            {!loading && users.filter(u => u.role === "Client").length === 0 && (
                <div className="text-center py-12 text-white/30">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No clients registered yet.</p>
                </div>
            )}
        </div>
    );
}
