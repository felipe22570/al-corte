import { notFound } from "next/navigation";

/** Unknown paths under /v2 show the v2 not-found screen, inside its own frame, instead of the current interface's. */
export default function MissingV2Page() {
  notFound();
}
