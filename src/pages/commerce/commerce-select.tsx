import type { ReactNode } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CommerceSelectOption<T extends string> = {
    value: T;
    label: string;
    disabled?: boolean;
    hint?: string;
};

type CommerceSelectProps<T extends string> = {
    value: T;
    options: CommerceSelectOption<T>[];
    onChange: (value: T) => void;
    ariaLabel: string;
    icon?: ReactNode;
    className?: string;
};

export function CommerceSelect<T extends string>({ value, options, onChange, ariaLabel, icon, className }: CommerceSelectProps<T>) {
    const selectedLabel = options.find((option) => option.value === value)?.label || value;

    return (
        <Select value={value} onValueChange={(next) => onChange(next as T)}>
            <SelectTrigger className={cn("commerce-select-trigger", className)} aria-label={ariaLabel}>
                {icon ? <span className="commerce-select-icon">{icon}</span> : null}
                <SelectValue>{selectedLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent className="commerce-select-content" position="popper" align="start" sideOffset={7}>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value} textValue={option.label} disabled={option.disabled} className="commerce-select-item">
                        <span className="commerce-select-option-copy">
                            <span>{option.label}</span>
                            {option.hint ? <small>{option.hint}</small> : null}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
