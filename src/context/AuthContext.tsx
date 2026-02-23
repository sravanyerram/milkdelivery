"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUser, createUser, updateUser, UserDoc } from "@/lib/firestore";

interface AuthContextValue {
    user: User | null;
    userDoc: UserDoc | null;
    loading: boolean;
    refreshUserDoc: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    userDoc: null,
    loading: true,
    refreshUserDoc: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserDoc = async (firebaseUser: User) => {
        // Hoist so catch block can reference it for the offline-admin fallback
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
        const isAdminEmail = firebaseUser.email === adminEmail;

        try {
            let existing = await getUser(firebaseUser.uid);

            if (!existing) {
                const newUser: UserDoc = {
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName
                        ?? firebaseUser.email?.split("@")[0]
                        ?? "User",
                    email: firebaseUser.email ?? "",
                    role: isAdminEmail ? "Admin" : "Client",
                    status: isAdminEmail ? "Approved" : "Pending",
                };
                await createUser(newUser);
                existing = newUser;
            } else if (isAdminEmail && (existing.role !== "Admin" || existing.status !== "Approved")) {
                // Admin doc existed with wrong role — upgrade it
                await updateUser(firebaseUser.uid, { role: "Admin", status: "Approved" });
                existing = { ...existing, role: "Admin", status: "Approved" };
            }

            setUserDoc(existing);
        } catch (err) {
            console.error("[AuthContext] Firestore fetch failed:", err);
            // Firestore offline — still let admin in using local state
            if (isAdminEmail) {
                setUserDoc({
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName ?? "Admin",
                    email: firebaseUser.email ?? "",
                    role: "Admin",
                    status: "Approved",
                });
            }
        }
    };

    const refreshUserDoc = async () => {
        if (user) await fetchUserDoc(user);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                await fetchUserDoc(firebaseUser);
            } else {
                setUserDoc(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, userDoc, loading, refreshUserDoc }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
