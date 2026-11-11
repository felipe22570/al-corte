import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginSubmitButtons } from "@/components/login-submit-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppWordmark } from "@/components/app-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_TAGLINE } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/movimientos");
  }

  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="w-full max-w-sm space-y-2"><AppWordmark /><p className="text-body text-muted-foreground">{APP_TAGLINE}</p></div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Inicia sesión</CardTitle>
          <CardDescription>Ingresa para consultar tus tarjetas de crédito.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
            {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" />
            </div>
            <LoginSubmitButtons />
          </form>
        </CardContent>
      </Card>
      <ThemeToggle />
    </main>
  );
}
