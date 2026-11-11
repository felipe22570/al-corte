const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error || !data) throw new Error("No pudimos consultar el tablero.");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}
