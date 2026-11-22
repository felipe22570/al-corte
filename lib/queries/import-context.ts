import { addDays, type IsoDate } from "@/lib/domain/dates";
import type { ExistingMovement, ExistingPayment } from "@/lib/domain/import-identity";
import type { MonthlyFile } from "@/lib/import/monthly-file";
import type { ImportCardRecord, ImportContext } from "@/lib/import/monthly-review";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawCard = { id: string; name: string; last4: string; color: ImportCardRecord["color"]; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: ImportCardRecord["amortizationMethod"]; interest_mode: ImportCardRecord["interestMode"] };
type RawMovement = { id: string; card_id: string; statement_id: string; type: string; date: IsoDate; merchant: string | null; amount: string; currency: "COP" | "USD"; import_key: string | null; subscription_id: string | null };
const movementFields = "id,card_id,statement_id,type,date,merchant,amount::text,currency,import_key,subscription_id";

function batches<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/**
 * Data of the owner the monthly import compares the file with (D55): movements around the dates of the file, the ones with
 * its keys, the ones of its statements (statement charges and installments of purchases from earlier months) and payments.
 */
export async function loadImportContext(supabase: Client, userId: string, file: MonthlyFile): Promise<ImportContext> {
  const [cardsResult, categoriesResult] = await Promise.all([
    supabase.from("cards").select("id,name,last4,color,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method,interest_mode").eq("user_id", userId).is("archived_at", null),
    supabase.from("categories").select("id,name").eq("user_id", userId).is("archived_at", null),
  ]);
  if (cardsResult.error || categoriesResult.error) throw new Error("No pudimos consultar tus tarjetas.");
  const cards = ((cardsResult.data ?? []) as unknown as RawCard[]).map((card): ImportCardRecord => ({
    id: card.id, name: card.name, last4: card.last4, color: card.color, cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea,
    advanceRateEa: card.advance_rate_ea, advanceFee: card.advance_fee, amortizationMethod: card.amortization_method, interestMode: card.interest_mode,
  }));
  const categories = (categoriesResult.data ?? []) as Array<{ id: string; name: string }>;
  const cardIds = cards.filter((card) => file.cards.some((item) => item.last4 === card.last4)).map((card) => card.id);
  if (!cardIds.length) return { cards, categories, rates: {}, movements: [], payments: [] };

  // Lines of purchases from earlier months keep their old date: they are found by key or by their installments.
  const dates = [...file.transactions.filter((item) => !item.prior_installments).map((item) => item.date), ...file.payments.map((item) => item.date)].sort();
  const from = addDays(dates[0] ?? file.statements[0]!.cutoff_date, -7);
  const to = addDays(dates.at(-1) ?? file.statements[0]!.cutoff_date, 7);
  const keys = [...file.transactions.map((item) => item.key)];
  const statementsResult = await supabase.from("statements").select("id,card_id,cutoff_date").eq("user_id", userId).in("card_id", cardIds);
  if (statementsResult.error) throw new Error("No pudimos consultar tus extractos.");
  const cutoffs = new Map((statementsResult.data ?? []).map((item) => [item.id, item.cutoff_date as IsoDate]));
  const fileStatements = (statementsResult.data ?? []).filter((item) => file.statements.some((statement) => statement.cutoff_date === item.cutoff_date && cards.find((card) => card.id === item.card_id)?.last4 === file.cards.find((entry) => entry.key === statement.card)?.last4)).map((item) => item.id);

  const [inWindow, byKey, inStatements, installments, payments] = await Promise.all([
    fetchAllPages((start, end) => supabase.from("transactions").select(movementFields).eq("user_id", userId).in("card_id", cardIds).neq("type", "payment").gte("date", from).lte("date", to).order("id").range(start, end)),
    Promise.all(batches(keys).map((ids) => fetchAllPages((start, end) => supabase.from("transactions").select(movementFields).eq("user_id", userId).in("import_key", ids).order("id").range(start, end)))),
    fileStatements.length ? fetchAllPages((start, end) => supabase.from("transactions").select(movementFields).eq("user_id", userId).in("statement_id", fileStatements).neq("type", "payment").order("id").range(start, end)) : Promise.resolve([]),
    fileStatements.length ? fetchAllPages((start, end) => supabase.from("installments").select("transaction_id").eq("user_id", userId).in("statement_id", fileStatements).order("id").range(start, end)) : Promise.resolve([]),
    fetchAllPages((start, end) => supabase.from("transactions").select("id,card_id,date,amount::text,currency").eq("user_id", userId).in("card_id", cardIds).eq("type", "payment").gte("date", from).lte("date", to).order("id").range(start, end)),
  ]);
  const known = new Map<string, RawMovement>();
  for (const item of [...inWindow, ...byKey.flat(), ...inStatements] as unknown as RawMovement[]) known.set(item.id, item);
  const missing = [...new Set((installments as Array<{ transaction_id: string }>).map((item) => item.transaction_id))].filter((id) => !known.has(id));
  for (const ids of batches(missing)) {
    const rows = await fetchAllPages((start, end) => supabase.from("transactions").select(movementFields).eq("user_id", userId).in("id", ids).order("id").range(start, end));
    for (const item of rows as unknown as RawMovement[]) known.set(item.id, item);
  }
  const subscriptionIds = [...new Set([...known.values()].flatMap((item) => item.subscription_id ? [item.subscription_id] : []))];
  const subscriptionsResult = subscriptionIds.length ? await supabase.from("subscriptions").select("id,name").eq("user_id", userId).in("id", subscriptionIds) : { data: [], error: null };
  if (subscriptionsResult.error) throw new Error("No pudimos consultar tus suscripciones.");
  const subscriptionNames = new Map((subscriptionsResult.data ?? []).map((item) => [item.id, item.name as string]));

  const usdDates = [...new Set(file.transactions.filter((item) => item.currency === "USD" && !item.fx_rate).map((item) => item.date))];
  const ratesResult = usdDates.length ? await supabase.from("fx_rates").select("date,usd_cop::text").in("date", usdDates) : { data: [], error: null };
  if (ratesResult.error) throw new Error("No pudimos consultar la TRM.");

  const movements: ExistingMovement[] = [...known.values()].map((item) => ({
    id: item.id, cardId: item.card_id, type: item.type, date: item.date, merchant: item.merchant, amount: item.amount, currency: item.currency, importKey: item.import_key,
    subscriptionId: item.subscription_id, subscriptionName: item.subscription_id ? subscriptionNames.get(item.subscription_id) ?? null : null,
    statementCutoff: cutoffs.get(item.statement_id) ?? item.date,
  }));
  return {
    cards, categories, movements,
    payments: (payments as unknown as Array<{ id: string; card_id: string; date: IsoDate; amount: string; currency: "COP" | "USD" }>).map((item): ExistingPayment => ({ id: item.id, cardId: item.card_id, date: item.date, amount: item.amount, currency: item.currency })),
    rates: Object.fromEntries(((ratesResult.data ?? []) as Array<{ date: IsoDate; usd_cop: string }>).map((item) => [item.date, item.usd_cop])),
  };
}
