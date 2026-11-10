import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Ajustes" };
export default function SettingsPage() {
  return <><PageHeader title="Ajustes" /><EmptyState icon={Settings} text="Pronto podrás administrar tus tarjetas y categorías aquí." /><section className="flex flex-wrap items-center justify-between gap-4"><ThemeToggle /><form action={signOut}><Button type="submit" variant="outline">Cerrar sesión</Button></form></section></>;
}
