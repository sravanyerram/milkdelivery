import { ReactNode } from "react";
import clsx from "clsx";

interface Props {
    options: string[];
    selected: string;
    onChange: (value: string) => void;
    className?: string;
    children?: ReactNode;
}

export function ChipSelector({ options, selected, onChange, className }: Props) {
    return (
        <div className={clsx("flex flex-wrap gap-2", className)}>
            {options.map((opt) => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={clsx(
                        "px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 active:scale-95",
                        selected === opt
                            ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/30"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20"
                    )}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
}
