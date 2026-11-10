"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="flex flex-col items-start gap-4"><h1 className="font-display text-title">No pudimos cargar esta pantalla</h1><p className="text-body text-muted-foreground">Inténtalo de nuevo.</p><Button onClick={reset}>Reintentar</Button></div>;
}
