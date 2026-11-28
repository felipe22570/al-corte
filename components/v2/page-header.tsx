import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Header of a screen: one h1 that names it (docs/design-v2.md, rules 1 and 2: no subtitle), an optional line above it
 * (date or path) and its actions. Detail screens get "‹ volver" on a phone.
 */
export function PageHeader({ title, eyebrow, trail, back, actions, className }: {
  title: ReactNode;
  /** A short line above the title, such as the date. */
  eyebrow?: ReactNode;
  /** Path to this screen on a desktop ("Tarjetas / Mastercard"). */
  trail?: Array<{ href: string; label: string }>;
  back?: { href: string; label?: string };
  actions?: ReactNode; className?: string;
}) {
  return <header className={cx("ui:flex ui:flex-wrap ui:items-end ui:justify-between ui:gap-3", className)}>
    <div className="ui:flex ui:min-w-0 ui:flex-col ui:gap-1">
      {back && <Link href={back.href} className="ui:inline-flex ui:min-h-11 ui:items-center ui:gap-1 ui:text-support ui:md:hidden"><ChevronLeft aria-hidden="true" className="ui:size-5" strokeWidth={1.75} />{back.label ?? "Volver"}</Link>}
      {trail && trail.length > 0 && <nav aria-label="Ruta" className="ui:hidden ui:text-support ui:text-text-3 ui:md:block">
        {trail.map((step, index) => <span key={step.href}>{index > 0 && " / "}<Link href={step.href} className="ui:text-text-3">{step.label}</Link></span>)}
      </nav>}
      {eyebrow && <div className="ui:text-support ui:text-text-3">{eyebrow}</div>}
      <h1 className="ui:m-0 ui:font-display ui:text-title">{title}</h1>
    </div>
    {actions && <div className="ui:flex ui:flex-wrap ui:items-center ui:gap-3">{actions}</div>}
  </header>;
}
