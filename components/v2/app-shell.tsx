import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";

/**
 * Frame of every screen: side navigation on a desktop, bottom navigation on a phone and the content centered up to
 * 1120 px. `aside` keeps room for a right panel (the future chat, D61) without changing the screens.
 */
export function AppShell({ draftCount, children, aside }: { draftCount: number; children: ReactNode; aside?: ReactNode }) {
  return <div className="ui:flex ui:min-h-dvh">
    <a href="#contenido" className="ui:sr-only ui:focus:not-sr-only ui:focus:fixed ui:focus:left-4 ui:focus:top-4 ui:focus:z-50 ui:focus:rounded-control ui:focus:bg-surface-raised ui:focus:p-3">Saltar al contenido</a>
    <SideNav draftCount={draftCount} />
    <div className="ui:flex ui:min-w-0 ui:flex-1 ui:flex-col">
      <div className="ui:px-5 ui:pt-4.5 ui:pb-1.5 ui:font-display ui:text-wordmark ui:md:hidden">{APP_NAME}</div>
      <main id="contenido" tabIndex={-1} className="ui:min-w-0 ui:flex-1 ui:px-3 ui:pt-2.5 ui:pb-32 ui:outline-none ui:md:px-10 ui:md:pt-8 ui:md:pb-14">
        <div className="ui:mx-auto ui:flex ui:w-full ui:max-w-content ui:flex-col ui:gap-6 ui:max-md:gap-3">{children}</div>
      </main>
    </div>
    {aside && <aside className="ui:hidden ui:w-90 ui:shrink-0 ui:border-l ui:border-line ui:xl:block">{aside}</aside>}
    <BottomNav draftCount={draftCount} />
  </div>;
}
