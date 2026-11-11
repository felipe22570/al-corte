"use client";

import { Button } from "@/components/ui/button";

export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4"><h1 className="font-display text-title">No pudimos cargar esta pantalla</h1><p className="text-body text-muted-foreground">Inténtalo de nuevo.</p><Button onClick={reset}>Reintentar</Button></main>;
}
