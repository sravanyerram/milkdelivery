"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { Home, Plane, FileText, LayoutDashboard, Users, TrendingUp, BarChart3, Truck } from "lucide-react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Milk, LogOut } from "lucide-react";
import Image from "next/image";

const CLIENT_TABS = [
    { href: "/client/dashboard", label: "Dashboard", icon: Home },
    { href: "/client/vacation", label: "Leave", icon: Plane },
    { href: "/client/invoices", label: "Bills", icon: FileText },
];

const ADMIN_TABS = [
    { href: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/delivery-run", label: "Delivery", icon: Truck },
    { href: "/admin/revenue", label: "Finance", icon: TrendingUp },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

/** Live notification badge for a single tab */
function Badge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-lg shadow-red-500/50 animate-pulse">
            {count > 9 ? "9+" : count}
        </span>
    );
}

function TabBar({
    tabs,
    badgeCounts = {},
}: {
    tabs: typeof CLIENT_TABS;
    badgeCounts?: Record<string, number>;
}) {
    const pathname = usePathname();
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-blue-950/90 backdrop-blur-xl border-t border-white/10">
            <div className="flex max-w-md mx-auto">
                {tabs.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href);
                    const badgeCount = badgeCounts[href] ?? 0;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all duration-200 ${active ? "text-blue-400" : "text-white/40 hover:text-white/70"
                                }`}
                        >
                            <div className="relative">
                                <Icon className={`w-5 h-5 ${active ? "text-blue-400" : ""}`} />
                                <Badge count={badgeCount} />
                            </div>
                            <span className="text-xs font-medium">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function TopHeader() {
    const { userDoc, user } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.warn("[SignOut] Firebase signOut failed (offline?), clearing locally.", err);
        }
        router.replace("/login");
    };
    return (
        <header className="sticky top-0 z-40 bg-blue-950/90 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                        <Milk className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white font-bold text-lg">milkdelivery</span>
                    {userDoc?.role === "Admin" && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full ml-1">Admin</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {user?.photoURL && (
                        <Image
                            src={user.photoURL}
                            alt="Profile"
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full border border-white/20"
                        />
                    )}
                    <button
                        onClick={handleSignOut}
                        className="p-2 text-white/40 hover:text-white/70 transition-colors"
                        title="Sign out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}

/** Hook: live count of open disputes + pending approvals (admin only) */
function useAdminBadge(isAdmin: boolean) {
    const [disputeCount, setDisputeCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (!isAdmin) return;

        const qDisputes = query(collection(db, "deliveries"), where("disputed", "==", true));
        const unsubDisputes = onSnapshot(qDisputes, (snap) => {
            setDisputeCount(snap.size);
        }, () => { /* ignore permission errors when offline */ });

        const qPending = query(collection(db, "users"), where("status", "==", "Pending"));
        const unsubPending = onSnapshot(qPending, (snap) => {
            setPendingCount(snap.size);
        }, () => { });

        return () => { unsubDisputes(); unsubPending(); };
    }, [isAdmin]);

    return disputeCount + pendingCount;
}

export default function AppLayout({ children }: { children: ReactNode }) {
    const { user, userDoc, loading } = useAuth();
    const router = useRouter();
    const isAdmin = userDoc?.role === "Admin";
    const alertCount = useAdminBadge(isAdmin);

    useEffect(() => {
        if (loading) return;
        if (!user) { router.replace("/login"); return; }
        if (!userDoc) { router.replace("/pending"); return; }
        if (userDoc.status === "Pending" || userDoc.status === "Rejected") {
            router.replace("/pending");
        }
    }, [user, userDoc, loading, router]);

    // Still loading — show spinner
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-950 to-indigo-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Not logged in or userDoc missing — redirect is in flight, render nothing
    if (!user || !userDoc) return null;

    const tabs = isAdmin ? ADMIN_TABS : CLIENT_TABS;

    // Badge only shown on the Dashboard tab for admins
    const badgeCounts: Record<string, number> = isAdmin
        ? { "/admin/dashboard": alertCount }
        : {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 text-white">
            <TopHeader />
            <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
                {children}
            </main>
            <TabBar tabs={tabs} badgeCounts={badgeCounts} />
        </div>
    );
}
