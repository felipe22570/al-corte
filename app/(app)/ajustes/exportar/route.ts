import { serializeCsv } from "@/lib/csv";
import { todayInBogota } from "@/lib/domain/dates";
import { EXPORT_TABLES, exportSelect, isExportTable, type ExportTable } from "@/lib/export-schema";
import { fetchAllPages } from "@/lib/paginate";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Inicia sesión para exportar tus datos.", { status: 401, headers });
  const params = new URL(request.url).searchParams;
  const format = params.get("formato");
  const table = params.get("tabla");
  if ((format !== "json" && format !== "csv") || (format === "csv" && !isExportTable(table))) return new Response("Formato o tabla inválidos.", { status: 400, headers });
  const selected = format === "csv" && isExportTable(table) ? [table] : Object.keys(EXPORT_TABLES) as ExportTable[];
  try {
    const results = await Promise.all(selected.map(async (name) => {
      const rows = await fetchAllPages((from, to) => {
        const query = supabase.from(name).select(exportSelect(name));
        return name === "fx_rates" ? query.order("date").range(from, to) : query.eq("user_id", user.id).order("id").range(from, to);
      });
      return [name, rows] as const;
    }));
    const date = todayInBogota();
    if (format === "csv" && isExportTable(table)) {
      const rows = results[0]![1] as unknown as Record<string, unknown>[];
      return new Response(serializeCsv(EXPORT_TABLES[table].columns, rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="al-corte-${table}-${date}.csv"` } });
    }
    return new Response(JSON.stringify({ app: "Al Corte", exported_on: date, schema_version: "20261110050000", tables: Object.fromEntries(results) }, null, 2), { headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="al-corte-${date}.json"` } });
  } catch {
    return new Response("No pudimos exportar tus datos. Inténtalo de nuevo.", { status: 500, headers });
  }
}
