import { EmptyState } from "@/components/v2/empty-state";
import { ButtonLink } from "@/components/v2/button";
import { v2Routes } from "@/lib/routes";

export default function V2NotFound() {
  return <EmptyState title="No encontramos esta pantalla" action={<ButtonLink href={v2Routes.home} variant="secondary">Ir al inicio</ButtonLink>} />;
}
