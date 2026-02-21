"use client";

import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, isFuture, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DeliveryDoc, VacationDoc } from "@/lib/firestore";

interface Props {
    currentMonth: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    deliveries: DeliveryDoc[];
    vacations: VacationDoc[];
    onSelectDay?: (date: Date) => void;
    selectedDate?: Date;
}

function isOnVacation(date: Date, vacations: VacationDoc[]): boolean {
    const d = format(date, "yyyy-MM-dd");
    return vacations.some((v) => d >= v.start_date && d <= v.end_date);
}

function hasDelivery(date: Date, deliveries: DeliveryDoc[]): boolean {
    const d = format(date, "yyyy-MM-dd");
    return deliveries.some((del) => del.date === d);
}

export function CalendarView({
    currentMonth,
    onPrevMonth,
    onNextMonth,
    deliveries,
    vacations,
    onSelectDay,
    selectedDate,
}: Props) {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Pad start with empty cells
    const startWeekday = getDay(start); // 0=Sun
    const blanks = Array(startWeekday).fill(null);

    const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    return (
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={onPrevMonth} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-5 h-5 text-white/70" />
                </button>
                <h2 className="text-white font-bold text-base">
                    {format(currentMonth, "MMMM yyyy")}
                </h2>
                <button onClick={onNextMonth} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                    <ChevronRight className="w-5 h-5 text-white/70" />
                </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-white/30 text-xs font-medium py-1">{d}</div>
                ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
                {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                {days.map((day) => {
                    const delivered = hasDelivery(day, deliveries);
                    const vacation = isOnVacation(day, vacations);
                    const today = isSameDay(day, new Date());
                    const selected = selectedDate && isSameDay(day, selectedDate);
                    const isRequest = delivered && isFuture(startOfDay(day));

                    let cls = "relative flex items-center justify-center rounded-xl h-9 text-sm font-medium transition-all duration-150 cursor-pointer ";
                    if (isRequest) cls += "bg-amber-500/25 text-amber-300 border border-amber-500/40 ";
                    else if (delivered) cls += "bg-green-500/25 text-green-300 border border-green-500/40 ";
                    else if (vacation) cls += "bg-red-500/20 text-red-300 border border-red-500/30 ";
                    else if (today) cls += "bg-blue-500/20 text-blue-300 border border-blue-500/40 ";
                    else cls += "text-white/60 hover:bg-white/10 ";
                    if (selected) cls += "ring-2 ring-blue-400 ";

                    return (
                        <button
                            key={day.toISOString()}
                            className={cls}
                            onClick={() => onSelectDay?.(day)}
                        >
                            {format(day, "d")}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="w-3 h-3 rounded-sm bg-green-500/40 border border-green-500/50" /> Delivered
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/40 border border-amber-500/50" /> Requested
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500/40" /> Vacation
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <span className="w-3 h-3 rounded-sm bg-blue-500/30 border border-blue-500/40" /> Today
                </span>
            </div>
        </div>
    );
}
