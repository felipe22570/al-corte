import { describe, expect, it } from "vitest";
import { serializeCsv } from "@/lib/csv";

describe("serializeCsv", () => {
  it("writes UTF-8 BOM, headers and escaped fields without losing decimal strings", () => {
    expect(serializeCsv(["nombre", "nota", "monto"], [{ nombre: "Café, local", nota: 'Una "línea"\ny otra', monto: "1234567.00" }])).toBe('\ufeffnombre,nota,monto\r\n"Café, local","Una ""línea""\ny otra",1234567.00\r\n');
  });
  it("exports headers for empty tables and blanks for nulls", () => {
    expect(serializeCsv(["id", "dato"], [])).toBe("\ufeffid,dato\r\n");
    expect(serializeCsv(["id", "dato"], [{ id: "1", dato: null }])).toBe("\ufeffid,dato\r\n1,\r\n");
  });
});
