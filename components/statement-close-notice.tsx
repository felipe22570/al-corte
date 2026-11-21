import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateShort } from "@/lib/format";

type Review = { cardId: string; cutoffDate: string };

/** F15: asks to close the latest statement of each card that is not reconciled with the bank yet (D39). */
export function StatementCloseNotice({ reviews, cards, today }: { reviews: Review[]; cards: Array<{ id: string; name: string }>; today: string }) {
  if (!reviews.length) return null;
  const name = (cardId: string) => cards.find((card) => card.id === cardId)?.name ?? "tarjeta";
  return <Alert variant="warning" role="note">
    <AlertTitle>{reviews.length === 1 ? `Revisa el extracto de tu ${name(reviews[0]!.cardId)}` : "Revisa los extractos de tus tarjetas"}</AlertTitle>
    <AlertDescription className="text-foreground">
      <p>Copia los valores del banco para confirmar que Al Corte cuadra.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">{reviews.map((review) => <Link key={review.cardId} className="underline pointer-coarse:min-h-11" href={`/tarjetas/${review.cardId}/extractos/${review.cutoffDate}#cierre`}>{name(review.cardId)} · corte {formatDateShort(review.cutoffDate, today)}</Link>)}</div>
    </AlertDescription>
  </Alert>;
}
