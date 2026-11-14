import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { ActionNotice } from "@/components/action-notice";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only rounded-md bg-card text-body text-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:p-3 focus:outline-2 focus:outline-ring">Saltar al contenido</a>
      <AppNav />
      <Suspense><ActionNotice /></Suspense>
      <div className="px-4 md:ml-64 md:px-6">
        <main id="main-content" tabIndex={-1} className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 pt-6 pb-[calc(11rem+env(safe-area-inset-bottom))] outline-none md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
