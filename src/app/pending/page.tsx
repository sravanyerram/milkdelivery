"use client";

import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Clock, RefreshCw, MessageCircle, LogOut, Milk } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PendingPage() {
    const { userDoc, refreshUserDoc, user } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    // Auto-redirect as soon as userDoc becomes Approved
    useEffect(() => {
        if (!userDoc) return;
        if (userDoc.status === "Approved") {
            router.replace(userDoc.role === "Admin" ? "/admin/dashboard" : "/client/dashboard");
        }
    }, [userDoc, router]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshUserDoc();
        } catch {
            // ignore — fetchUserDoc already handles errors internally
        } finally {
            setRefreshing(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.warn("[SignOut] Firebase signOut failed (offline?), clearing locally.", err);
        }
        router.replace("/login");
    };

    const vendorWhatsApp = "https://wa.me/?text=Hi%2C%20I%20just%20signed%20up%20for%20Mik%20Delivery%20and%20my%20account%20is%20pending%20approval.%20My%20email%20is%20" + encodeURIComponent(user?.email ?? "");

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 flex items-center justify-center p-4">
            <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

            <div className="w-full max-w-md">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">

                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Milk className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    {/* Hourglass animation */}
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-amber-500/10 border border-amber-400/20 rounded-full flex items-center justify-center">
                            <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">Account Pending Approval</h1>
                    <p className="text-white/60 text-sm leading-relaxed mb-2">
                        Hello <span className="text-blue-300 font-medium">{userDoc?.name ?? "there"}</span>, we have received your registration.
                    </p>
                    <p className="text-white/50 text-sm leading-relaxed mb-8">
                        The vendor will review and activate your account shortly. This usually takes less than a day.
                    </p>

                    {/* Refresh Button */}
                    <button
                        id="refresh-status-btn"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3.5 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-60 mb-3"
                    >
                        <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
                        {refreshing ? "Checking…" : "Refresh Status"}
                    </button>

                    {/* WhatsApp Contact */}
                    <a
                        href={vendorWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-medium py-3.5 rounded-2xl transition-all duration-200 mb-4"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Contact Vendor on WhatsApp
                    </a>

                    {/* Sign out */}
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-sm mx-auto transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
}
