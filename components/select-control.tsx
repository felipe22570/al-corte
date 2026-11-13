"use client";

import type { ComponentProps, ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = { value: string; label: string; disabled?: boolean; startAdornment?: ReactNode };

type Props = Omit<ComponentProps<typeof SelectTrigger>, "value" | "defaultValue" | "onChange"> & {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
};

export function SelectControl({ options, value, defaultValue, onValueChange, name, placeholder = "Elige una opción", disabled, ...props }: Props) {
  const optionContent = (option: SelectOption, selected = false) => <span className="flex min-w-0 items-center gap-2">{option.startAdornment && <span aria-hidden="true" className="flex shrink-0 items-center">{option.startAdornment}</span>}<span className={selected ? "min-w-0 truncate" : "min-w-0 wrap-anywhere"}>{option.label}</span></span>;
  return <Select items={options} value={value} defaultValue={defaultValue} onValueChange={(next) => { if (next !== null) onValueChange?.(next); }} name={name} disabled={disabled}>
    <SelectTrigger {...props} disabled={disabled}><SelectValue placeholder={placeholder}>{(selected: string | null) => { const option = options.find((option) => option.value === selected); return option ? optionContent(option, true) : placeholder; }}</SelectValue></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{optionContent(option)}</SelectItem>)}</SelectContent>
  </Select>;
}
