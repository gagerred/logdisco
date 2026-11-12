import { describe, expect, it } from "vitest";
import { mensagemDeErro } from "@/lib/auth-errors";

describe("mensagemDeErro", () => {
  it("não exibe nada quando o usuário fecha a janela do Google", () => {
    expect(mensagemDeErro({ code: "auth/popup-closed-by-user" })).toBeNull();
  });
  it("trata credencial inválida como e-mail ou senha incorretos", () => {
    expect(mensagemDeErro({ code: "auth/invalid-credential" })).toMatch(/incorretos/);
    expect(mensagemDeErro({ code: "auth/wrong-password" })).toMatch(/incorretos/);
  });
  it("usa mensagem genérica para códigos desconhecidos", () => {
    expect(mensagemDeErro({ code: "auth/algo-novo" })).toMatch(/Tente novamente/);
    expect(mensagemDeErro(new Error("x"))).toMatch(/Tente novamente/);
  });
});
