import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "soft" | "secondary" | "danger" | "link" | "danger-link" | "icon" | "square" | "more";

const base = "ui:inline-flex ui:items-center ui:justify-center ui:gap-2 ui:whitespace-nowrap ui:no-underline ui:cursor-pointer ui:disabled:cursor-not-allowed ui:disabled:opacity-50";
const variants: Record<ButtonVariant, string> = {
  // Como máximo una por pantalla (D66).
  primary: "ui:h-10 ui:max-md:h-12 ui:px-4.5 ui:rounded-control ui:bg-primary ui:text-on-primary ui:text-body ui:font-semibold",
  soft: "ui:h-10 ui:max-md:h-12 ui:px-4.5 ui:rounded-control ui:bg-primary-soft ui:text-primary ui:text-body ui:font-semibold",
  secondary: "ui:h-9 ui:max-md:h-11 ui:px-3.5 ui:rounded-control ui:border ui:border-strong-border ui:bg-transparent ui:text-text ui:text-support ui:font-medium",
  danger: "ui:h-9 ui:max-md:h-11 ui:px-3.5 ui:rounded-control ui:border ui:border-danger ui:bg-transparent ui:text-danger ui:text-support ui:font-medium",
  link: "ui:min-h-0 ui:p-0 ui:bg-transparent ui:text-primary ui:hover:text-primary-hover ui:text-support ui:underline ui:underline-offset-2 ui:pointer-coarse:min-h-11",
  "danger-link": "ui:min-h-0 ui:p-0 ui:bg-transparent ui:text-danger ui:text-support ui:underline ui:underline-offset-2 ui:pointer-coarse:min-h-11",
  icon: "ui:size-9 ui:max-md:size-11 ui:rounded-control ui:bg-surface-raised ui:text-text-2",
  // Bordered squares: − and + of the stepper (40 px) and the "···" menu trigger (36 px).
  square: "ui:size-10 ui:max-md:size-11 ui:shrink-0 ui:rounded-control ui:border ui:border-strong-border ui:bg-transparent ui:text-text",
  more: "ui:size-9 ui:max-md:size-11 ui:shrink-0 ui:rounded-control ui:border ui:border-strong-border ui:bg-transparent ui:text-text",
};

export function buttonClasses(variant: ButtonVariant = "secondary", className?: string): string {
  return cx(base, variants[variant], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "secondary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & { variant?: ButtonVariant; className?: string; children: ReactNode };

/** A link that looks like a button; `data-v2-button` keeps it out of the base link color. */
export function ButtonLink({ variant = "secondary", className, ...props }: ButtonLinkProps) {
  return <Link data-v2-button="" className={buttonClasses(variant, className)} {...props} />;
}
