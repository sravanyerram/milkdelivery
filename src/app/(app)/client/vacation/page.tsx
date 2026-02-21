"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { saveVacation, getVacationsForClient, deleteVacation, VacationDoc } from "@/lib/firestore";
import { format, parseISO, differenceInDays } from "date-fns";
import { CalendarDays, MessageCircle, CheckCircle, PlaneLanding, Trash2, Plus, X } from "lucide-react";

export default function VacationPage() {
    const { userDoc } = useAuth();
    const [vacations, setVacations] = useState<VacationDoc[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const today = format(new Date(), "yyyy-MM-dd");

    const loadVacations = useCallback(async () => {
        if (!userDoc) return;
        const vacs = await getVacationsForClient(userDoc.uid);
        // Sort: upcoming first, then past
        setVacations(vacs.sort((a, b) => b.start_date.localeCompare(a.start_date)));
    }, [userDoc]);

    useEffect(() => { loadVacations(); }, [loadVacations]);

    const handleSave = async () => {
        if (!userDoc) return;
        if (!startDate || !endDate) { setError("Please select both dates."); return; }
        if (startDate > endDate) { setError("End date must be after start date."); return; }
        setError("");
        setSaving(true);
        await saveVacation({
            client_uid: userDoc.uid,
            start_date: startDate,
            end_date: endDate,
            reason: reason || undefined,
        });
        setSaved(true);
        setSaving(false);
        setStartDate("");
        setEndDate("");
        setReason("");
        setShowForm(false);
        await loadVacations();
        setTimeout(() => setSaved(false), 3000);
    };

    const handleDelete = async (v: VacationDoc) => {
        if (!v.id) return;
        setDeletingId(v.id);
        await deleteVacation(v.id);
        setDeletingId(null);
        await loadVacations();
    };

    const activeVacations = vacations.filter((v) => v.end_date >= today);
    const pastVacations = vacations.filter((v) => v.end_date < today);

    const vendorMsg = `Hi! I've requested a vacation pause from ${startDate || "TBD"} to ${endDate || "TBD"}. Please confirm. — ${userDoc?.name}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(vendorMsg)}`;

    const getDays = (v: VacationDoc) => differenceInDays(parseISO(v.end_date), parseISO(v.start_date)) + 1;

    const isActive = (v: VacationDoc) => today >= v.start_date && today <= v.end_date;
    const isUpcoming = (v: VacationDoc) => v.start_date > today;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-600/30 to-indigo-600/20 border border-purple-500/20 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <PlaneLanding className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-white font-bold text-lg">Vacation Mode</h1>
                            <p className="text-purple-300 text-sm">
                                {activeVacations.length > 0
                                    ? `${activeVacations.length} active pause${activeVacations.length > 1 ? "s" : ""}`
                                    : "Pause your milk deliveries"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm((s) => !s)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl text-sm font-medium transition-colors"
                    >
                        {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add</>}
                    </button>
                </div>
            </div>

            {/* Success banner */}
            {saved && (
                <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-3">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Vacation saved! Deliveries will be paused for those dates.
                </div>
            )}

            {/* Add vacation form */}
            {showForm && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <p className="text-white/50 text-xs uppercase tracking-wider">New Vacation Period</p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">From</label>
                            <input
                                id="vacation-start"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                min={today}
                                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark] text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">To</label>
                            <input
                                id="vacation-end"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate || today}
                                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark] text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-white/50 text-xs uppercase tracking-wider block mb-2">Reason (optional)</label>
                        <textarea
                            id="vacation-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Going out of town…"
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none placeholder:text-white/20 text-sm"
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <div className="flex gap-2">
                        <button
                            id="save-vacation-btn"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-3 bg-purple-500 hover:bg-purple-400 disabled:opacity-60 text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                            {saving ? "Saving…" : "Save Vacation"}
                        </button>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-semibold rounded-2xl transition-all flex items-center gap-1.5 text-sm"
                        >
                            <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                    </div>
                </div>
            )}

            {/* Active & upcoming vacations */}
            {activeVacations.length > 0 && (
                <div className="space-y-2">
                    <p className="text-white/40 text-xs uppercase tracking-wider px-1">Active & Upcoming</p>
                    {activeVacations.map((v) => (
                        <div key={v.id} className={`rounded-2xl border p-4 flex items-start justify-between gap-3 ${isActive(v) ? "bg-purple-500/15 border-purple-500/30" : "bg-white/5 border-white/10"}`}>
                            <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive(v) ? "bg-purple-500/30" : "bg-white/10"}`}>
                                    <PlaneLanding className={`w-4 h-4 ${isActive(v) ? "text-purple-300" : "text-white/50"}`} />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">
                                        {format(parseISO(v.start_date), "d MMM")} → {format(parseISO(v.end_date), "d MMM yyyy")}
                                    </p>
                                    <p className="text-white/40 text-xs mt-0.5">
                                        {getDays(v)} day{getDays(v) > 1 ? "s" : ""} · {isActive(v) ? "🟢 Active now" : isUpcoming(v) ? "⏳ Upcoming" : ""}
                                    </p>
                                    {v.reason && <p className="text-white/30 text-xs italic mt-0.5">"{v.reason}"</p>}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(v)}
                                disabled={deletingId === v.id}
                                className="p-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                            >
                                {deletingId === v.id
                                    ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                    : <Trash2 className="w-4 h-4" />}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Past vacations */}
            {pastVacations.length > 0 && (
                <div className="space-y-2">
                    <p className="text-white/40 text-xs uppercase tracking-wider px-1">Past Vacations</p>
                    {pastVacations.map((v) => (
                        <div key={v.id} className="bg-white/3 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3 opacity-50">
                            <div>
                                <p className="text-white text-sm">{format(parseISO(v.start_date), "d MMM")} → {format(parseISO(v.end_date), "d MMM yyyy")}</p>
                                <p className="text-white/30 text-xs">{getDays(v)} days</p>
                            </div>
                            <button onClick={() => handleDelete(v)} disabled={deletingId === v.id} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {vacations.length === 0 && !showForm && (
                <div className="text-center py-12 space-y-2">
                    <PlaneLanding className="w-10 h-10 text-white/10 mx-auto" />
                    <p className="text-white/30 text-sm">No vacations scheduled</p>
                    <button onClick={() => setShowForm(true)} className="text-purple-400 text-sm underline underline-offset-2">Schedule one now</button>
                </div>
            )}
        </div>
    );
}
