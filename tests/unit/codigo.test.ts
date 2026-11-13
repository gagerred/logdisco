import { describe, expect, it } from "vitest";
import { normalizarCodigoRelease } from "@/lib/discogs/codigo";

describe("normalizarCodigoRelease", () => {
  it.each([
    ["R123456", 123456],
    ["123456", 123456],
    ["[R123456]", 123456],
    ["r123456", 123456],
    ["[r123456]", 123456],
    ["  R123456  ", 123456],
    ["[ R123456 ]", 123456],
    ["R0000789", 789],
  ])("aceita %s", (entrada, id) => {
    expect(normalizarCodigoRelease(entrada)).toEqual({ ok: true, id });
  });

  it.each(["", "   ", "R", "[R123456", "R123456]", "abc", "R12a3", "0", "R0", "-5", "R1 2", "12345678901"])(
    "rejeita %j",
    (entrada) => {
      expect(normalizarCodigoRelease(entrada).ok).toBe(false);
    },
  );

  it("explica que código de Master não é um lançamento", () => {
    const r = normalizarCodigoRelease("M96559");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Master/);
  });
});
