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
      <AppNav />
      <Suspense><ActionNotice /></Suspense>
      <div className="px-4 md:ml-64 md:px-6">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-6 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
