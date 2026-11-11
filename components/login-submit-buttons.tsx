"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signIn, signInWithMagicLink } from "@/lib/actions/auth";

export function LoginSubmitButtons() {
  const { pending } = useFormStatus();
  return <><Button className="w-full" type="submit" formAction={signIn} disabled={pending}>{pending ? "Procesando…" : "Ingresar"}</Button><Button className="w-full" type="submit" variant="outline" formAction={signInWithMagicLink} disabled={pending}>Enviarme un enlace</Button></>;
}
