"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { Home, Plane, FileText, LayoutDashboard, Users, TrendingUp } from "lucide-react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Milk, LogOut } from "lucide-react";
import Image from "next/image";

const CLIENT_TABS = [
    { href: "/client/dashboard", label: "Home", icon: Home },
    { href: "/client/vacation", label: "Vacation", icon: Plane },
    { href: "/client/invoices", label: "Invoices", icon: FileText },
];

const ADMIN_TABS = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/revenue", label: "Revenue", icon: TrendingUp },
];

function TabBar({ tabs }: { tabs: typeof CLIENT_TABS }) {
    const pathname = usePathname();
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-blue-950/90 backdrop-blur-xl border-t border-white/10">
            <div className="flex max-w-md mx-auto">
                {tabs.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all duration-200 ${active ? "text-blue-400" : "text-white/40 hover:text-white/70"
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${active ? "text-blue-400" : ""}`} />
                            <span className="text-xs font-medium">{label}</span>
                            {active && <div className="w-1 h-1 rounded-full bg-blue-400 absolute bottom-2 hidden" />}
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

export default function AppLayout({ children }: { children: ReactNode }) {
    const { user, userDoc, loading } = useAuth();
    const router = useRouter();

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

    const tabs = userDoc.role === "Admin" ? ADMIN_TABS : CLIENT_TABS;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 text-white">
            <TopHeader />
            <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
                {children}
            </main>
            <TabBar tabs={tabs} />
        </div>
    );
}
