import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-4"><h1 className="font-display text-title">No encontramos esta página</h1><p className="text-body text-muted-foreground">Revisa la dirección o vuelve al tablero.</p><Link href="/" className="flex min-h-11 items-center rounded-md border border-border px-4 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Volver al tablero</Link></main>;
}
