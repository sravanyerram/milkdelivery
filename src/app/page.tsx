"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Root page — smart redirect based on auth & role
export default function RootPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // userDoc may be null if Firestore is offline/misconfigured.
    // Fall back to pending screen so the user sees something useful.
    if (!userDoc) {
      router.replace("/pending");
      return;
    }
    if (userDoc.status === "Pending" || userDoc.status === "Rejected") {
      router.replace("/pending");
    } else if (userDoc.role === "Admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/client/dashboard");
    }
  }, [user, userDoc, loading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-indigo-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
