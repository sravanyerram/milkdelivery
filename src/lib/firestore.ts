import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    getDocs,
    addDoc,
    Timestamp,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Client";
export type UserStatus = "Pending" | "Approved" | "Rejected";
export type InvoiceStatus = "Unpaid" | "Pending" | "Confirmed";

export interface UserDoc {
    uid: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    phone?: string;
    address?: string;
    defaultProduct?: string; // product id
    defaultQty?: number;
    createdAt?: Timestamp;
}

export interface ProductDoc {
    id: string;
    name: "Buffalo" | "Cow";
    price: number; // per litre in ₹
}

export interface DeliveryDoc {
    id?: string;
    client_uid: string;
    date: string; // "YYYY-MM-DD"
    product_id: string;
    product_name: string;
    quantity: number; // litres (admin/system logged)
    total_cost: number;
    createdAt?: Timestamp;
    // ── Dispute fields ───────────────────────────────────────────────────
    disputed?: boolean;               // client raised a dispute
    client_quantity?: number;         // what the client claims was delivered
    dispute_status?: "Pending" | "Approved" | "Rejected";
    dispute_note?: string;            // optional context from client
}

export interface InvoiceDoc {
    id?: string;
    client_uid: string;
    month_year: string; // "YYYY-MM"
    total_amount: number;
    status: InvoiceStatus;
    dispute_notes?: DisputeNote[];
    updatedAt?: Timestamp;
}

export interface DisputeNote {
    author: "Client" | "Admin";
    message: string;
    timestamp: string;
}

export interface VacationDoc {
    id?: string;
    client_uid: string;
    start_date: string; // "YYYY-MM-DD"
    end_date: string;
    reason?: string;
    createdAt?: Timestamp;
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<UserDoc | null> {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function createUser(user: UserDoc) {
    await setDoc(doc(db, "users", user.uid), {
        ...user,
        createdAt: serverTimestamp(),
    });
}

export async function updateUser(uid: string, data: Partial<UserDoc>) {
    await updateDoc(doc(db, "users", uid), data as Record<string, unknown>);
}

export async function getAllUsers(): Promise<UserDoc[]> {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => d.data() as UserDoc);
}

export async function getApprovedClients(): Promise<UserDoc[]> {
    // Single-field query — second filter done in JS to avoid composite index
    const snap = await getDocs(collection(db, "users"));
    return snap.docs
        .map((d) => d.data() as UserDoc)
        .filter((u) => u.status === "Approved" && u.role === "Client");
}

export async function getPendingUsers(): Promise<UserDoc[]> {
    const q = query(collection(db, "users"), where("status", "==", "Pending"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserDoc);
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<ProductDoc[]> {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductDoc));
}

export async function seedProducts() {
    const products = [
        { name: "Buffalo", price: 70 },
        { name: "Cow", price: 70 },
    ];
    for (const p of products) {
        const q = query(collection(db, "products"), where("name", "==", p.name));
        const snap = await getDocs(q);
        if (snap.empty) {
            await addDoc(collection(db, "products"), p);
        }
    }
}

// ── Deliveries ────────────────────────────────────────────────────────────────

export async function logDelivery(data: Omit<DeliveryDoc, "id">) {
    // Query by client_uid (a field the client CAN read per security rules).
    // Filter by date in JS — avoids both composite-index and permissions issues.
    const q = query(
        collection(db, "deliveries"),
        where("client_uid", "==", data.client_uid)
    );
    const snap = await getDocs(q);
    const existing = snap.docs.find((d) => d.data().date === data.date);
    if (existing) {
        await updateDoc(existing.ref, { ...data, createdAt: serverTimestamp() });
    } else {
        await addDoc(collection(db, "deliveries"), { ...data, createdAt: serverTimestamp() });
    }
}

export async function getDeliveriesForClient(
    client_uid: string,
    month_year: string // "YYYY-MM"
): Promise<DeliveryDoc[]> {
    // Single-field query — month and sort done in JS to avoid composite index
    const q = query(
        collection(db, "deliveries"),
        where("client_uid", "==", client_uid)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DeliveryDoc))
        .filter((d) => d.date.startsWith(month_year))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Delivery Disputes ─────────────────────────────────────────────────────────

/** Client raises a dispute: marks the delivery with what they claim was delivered */
export async function raiseDeliveryDispute(
    deliveryId: string,
    clientQty: number,
    note: string
): Promise<void> {
    await updateDoc(doc(db, "deliveries", deliveryId), {
        disputed: true,
        client_quantity: clientQty,
        dispute_status: "Pending",
        dispute_note: note || "",
    });
}

/** Admin approves (corrects quantity + recalcs invoice) or rejects a dispute */
export async function resolveDeliveryDispute(
    delivery: DeliveryDoc,
    approve: boolean,
    productPrice: number
): Promise<void> {
    if (!delivery.id) return;
    if (approve && delivery.client_quantity !== undefined) {
        const newQty = delivery.client_quantity;
        const newCost = newQty * productPrice;
        await updateDoc(doc(db, "deliveries", delivery.id), {
            quantity: newQty,
            total_cost: newCost,
            disputed: false,
            dispute_status: "Approved",
        });
        await recalcInvoice(delivery.client_uid, delivery.date.slice(0, 7));
    } else {
        await updateDoc(doc(db, "deliveries", delivery.id), {
            disputed: false,
            dispute_status: "Rejected",
        });
    }
}

/** Admin fetches all deliveries currently flagged as disputed */
export async function getDisputedDeliveries(): Promise<DeliveryDoc[]> {
    const q = query(
        collection(db, "deliveries"),
        where("disputed", "==", true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryDoc));
}

/** Save client's daily default (product id + qty in litres) */
export async function setClientDefault(
    uid: string,
    defaultProduct: string,
    defaultQty: number
): Promise<void> {
    await updateUser(uid, { defaultProduct, defaultQty });
}

export async function getTodayDeliveriesAdmin(
    date: string
): Promise<DeliveryDoc[]> {
    const q = query(
        collection(db, "deliveries"),
        where("date", "==", date)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeliveryDoc));
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function getInvoicesForClient(
    client_uid: string
): Promise<InvoiceDoc[]> {
    const q = query(
        collection(db, "invoices"),
        where("client_uid", "==", client_uid)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as InvoiceDoc))
        .sort((a, b) => b.month_year.localeCompare(a.month_year));
}

export async function getAllInvoices(): Promise<InvoiceDoc[]> {
    const snap = await getDocs(collection(db, "invoices"));
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as InvoiceDoc))
        .sort((a, b) => b.month_year.localeCompare(a.month_year));
}

export async function upsertInvoice(
    client_uid: string,
    month_year: string,
    total_amount: number
): Promise<string> {
    // Single-field query to avoid composite index requirement
    const q = query(collection(db, "invoices"), where("client_uid", "==", client_uid));
    const snap = await getDocs(q);
    const existing = snap.docs.find((d) => d.data().month_year === month_year);
    if (existing) {
        await updateDoc(existing.ref, { total_amount, updatedAt: serverTimestamp() });
        return existing.id;
    } else {
        const ref = await addDoc(collection(db, "invoices"), {
            client_uid,
            month_year,
            total_amount,
            status: "Unpaid",
            dispute_notes: [],
            updatedAt: serverTimestamp(),
        });
        return ref.id;
    }
}

/**
 * Recalculates an invoice total from the source-of-truth (all deliveries for
 * that month) and saves it. Always call this after logging a delivery instead
 * of passing individual delivery costs to upsertInvoice directly.
 */
export async function recalcInvoice(
    client_uid: string,
    month_year: string
): Promise<void> {
    const deliveries = await getDeliveriesForClient(client_uid, month_year);
    const total = deliveries.reduce((sum, d) => sum + d.total_cost, 0);
    await upsertInvoice(client_uid, month_year, total);
}

export async function updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus
) {
    await updateDoc(doc(db, "invoices", invoiceId), {
        status,
        updatedAt: serverTimestamp(),
    });
}

export async function addDisputeNote(
    invoiceId: string,
    note: DisputeNote,
    currentNotes: DisputeNote[]
) {
    await updateDoc(doc(db, "invoices", invoiceId), {
        dispute_notes: [...currentNotes, note],
        updatedAt: serverTimestamp(),
    });
}

// ── Vacations ─────────────────────────────────────────────────────────────────

export async function saveVacation(data: Omit<VacationDoc, "id">) {
    const docData: Record<string, unknown> = {
        client_uid: data.client_uid,
        start_date: data.start_date,
        end_date: data.end_date,
        createdAt: serverTimestamp(),
    };
    if (data.reason) docData.reason = data.reason;
    await addDoc(collection(db, "vacations"), docData);
}

export async function deleteVacation(vacationId: string): Promise<void> {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "vacations", vacationId));
}

export async function getVacationsForClient(
    client_uid: string
): Promise<VacationDoc[]> {
    const q = query(
        collection(db, "vacations"),
        where("client_uid", "==", client_uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VacationDoc));
}

export async function getAllVacations(): Promise<VacationDoc[]> {
    const snap = await getDocs(collection(db, "vacations"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VacationDoc));
}
