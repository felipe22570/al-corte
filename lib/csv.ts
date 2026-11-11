export function serializeCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\ufeff${[columns.map(cell).join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\r\n")}\r\n`;
}
