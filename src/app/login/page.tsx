"use client";

import { useState } from "react";
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Milk, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

type Mode = "signin" | "signup";

const FRIENDLY_ERRORS: Record<string, string> = {
    "auth/user-not-found": "No account with that email. Please sign up.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists. Please sign in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
};

function friendlyError(code: string): string {
    return FRIENDLY_ERRORS[code] ?? "Something went wrong. Please try again.";
}

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState("");

    const handleGoogle = async () => {
        setGoogleLoading(true);
        setError("");
        try {
            await signInWithPopup(auth, googleProvider);
            router.push("/");
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? "";
            setError(friendlyError(code));
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleEmail = async () => {
        setError("");
        if (!email || !password) { setError("Please fill in all fields."); return; }
        if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return; }
        setLoading(true);
        try {
            if (mode === "signup") {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(cred.user, { displayName: name.trim() });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            router.push("/");
        } catch (err: unknown) {
            const code = (err as { code?: string }).code ?? "";
            setError(friendlyError(code));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 flex items-center justify-center p-4">
            {/* Decorative blobs */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            <div className="relative w-full max-w-md">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

                    {/* Logo */}
                    <div className="flex flex-col items-center mb-7">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
                            <Milk className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">milkdelivery</h1>
                        <p className="text-blue-300 mt-0.5 text-sm">Fresh milk, every morning 🥛</p>
                    </div>

                    {/* Google */}
                    <button
                        id="google-signin-btn"
                        onClick={handleGoogle}
                        disabled={googleLoading || loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-2xl transition-all active:scale-95 disabled:opacity-60 shadow-lg mb-5"
                    >
                        {googleLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex-1 border-t border-white/10" />
                        <span className="text-white/30 text-xs">or</span>
                        <div className="flex-1 border-t border-white/10" />
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex bg-white/5 rounded-xl p-1 mb-5">
                        {(["signin", "signup"] as Mode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setError(""); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? "bg-blue-500 text-white shadow" : "text-white/40 hover:text-white/70"}`}
                            >
                                {m === "signin" ? "Sign In" : "Sign Up"}
                            </button>
                        ))}
                    </div>

                    {/* Fields */}
                    <div className="space-y-3">
                        {mode === "signup" && (
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/25"
                                />
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                                className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/25"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type={showPw ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                                className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/25"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw((s) => !s)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                            >
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
                    )}

                    <button
                        onClick={handleEmail}
                        disabled={loading || googleLoading}
                        className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        {loading
                            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : mode === "signin" ? "Sign In with Email" : "Create Account"}
                    </button>

                    <p className="text-center text-white/25 text-xs mt-5">
                        By continuing, you agree to our terms of service.
                    </p>
                </div>
            </div>
        </div>
    );
}
