"use client";

import type { ComponentProps } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = Omit<ComponentProps<typeof SelectTrigger>, "value" | "defaultValue" | "onChange"> & {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
};

export function SelectControl({ options, value, defaultValue, onValueChange, name, placeholder = "Elige una opción", disabled, ...props }: Props) {
  return <Select items={options} value={value} defaultValue={defaultValue} onValueChange={(next) => { if (next !== null) onValueChange?.(next); }} name={name} disabled={disabled}>
    <SelectTrigger {...props} disabled={disabled}><SelectValue placeholder={placeholder}>{(selected: string | null) => options.find((option) => option.value === selected)?.label ?? placeholder}</SelectValue></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
