import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DesignCatalog } from "@/components/v2/design-catalog";

export const metadata: Metadata = { title: "Componentes" };

function ThemeColumn({ theme, title, children }: { theme: "dark" | "light"; title: string; children: ReactNode }) {
  return <section data-ui-theme={theme} aria-labelledby={`tema-${theme}`} className="ui:flex ui:min-w-0 ui:flex-col ui:gap-4 ui:rounded-hero ui:bg-ground ui:p-6 ui:text-text ui:max-md:p-3">
    <h2 id={`tema-${theme}`} className="ui:m-0 ui:text-label ui:uppercase ui:text-text-3">{title}</h2>
    {children}
  </section>;
}

/**
 * Internal gallery of the v2 components and states (equivalent to docs/mockups/v2/estados.html), in both themes, for the
 * owner to approve before building screens. Behind the session like every /v2 page; it goes away in step 56.
 */
export default function DesignGalleryPage() {
  return <>
    <h1 className="ui:m-0 ui:font-display ui:text-title">Componentes</h1>
    <div className="ui:grid ui:items-start ui:gap-6 ui:xl:grid-cols-2">
      <ThemeColumn theme="dark" title="Oscuro"><DesignCatalog idPrefix="oscuro" /></ThemeColumn>
      <ThemeColumn theme="light" title="Claro"><DesignCatalog idPrefix="claro" /></ThemeColumn>
    </div>
  </>;
}
