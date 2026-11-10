import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, signInWithMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Al Corte</CardTitle>
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
            <Button className="w-full" type="submit" formAction={signIn}>Ingresar</Button>
            <Button className="w-full" type="submit" variant="outline" formAction={signInWithMagicLink}>Enviar enlace mágico</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
