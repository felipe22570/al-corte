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

  return <div className="min-h-screen bg-background"><AppNav /><Suspense><ActionNotice /></Suspense><main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-6 pb-[calc(11rem+env(safe-area-inset-bottom))] md:ml-64 md:px-6 md:pb-8">{children}</main></div>;
}
