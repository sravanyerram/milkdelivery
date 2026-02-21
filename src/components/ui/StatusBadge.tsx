import clsx from "clsx";
import { UserStatus, InvoiceStatus } from "@/lib/firestore";

type Status = UserStatus | InvoiceStatus | "Vacation" | "Delivered";

const MAP: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
    Pending: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", label: "Pending" },
    Approved: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", label: "Approved" },
    Rejected: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", label: "Rejected" },
    Unpaid: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", label: "Unpaid" },
    Confirmed: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", label: "Confirmed" },
    Vacation: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400", label: "On Vacation" },
    Delivered: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", label: "Delivered" },
};

export function StatusBadge({ status }: { status: Status }) {
    const s = MAP[status] ?? MAP["Pending"];
    return (
        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold", s.bg, s.text)}>
            <span className={clsx("w-1.5 h-1.5 rounded-full", s.dot)} />
            {s.label}
        </span>
    );
}
