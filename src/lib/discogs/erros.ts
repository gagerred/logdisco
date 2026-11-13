export type TipoErroDiscogs =
  | "nao_encontrado"
  | "limite"
  | "autenticacao"
  | "indisponivel"
  | "resposta_invalida"
  | "requisicao_invalida";

export class DiscogsErro extends Error {
  constructor(
    public tipo: TipoErroDiscogs,
    mensagem: string,
    public extra: { status?: number; retryAfterSegundos?: number } = {},
  ) {
    super(mensagem);
    this.name = "DiscogsErro";
  }
}

export function erroPorStatus(status: number): DiscogsErro {
  if (status === 404) return new DiscogsErro("nao_encontrado", "Não encontrado no Discogs.", { status });
  if (status === 401 || status === 403) {
    return new DiscogsErro(
      "autenticacao",
      "O Discogs recusou o acesso. Vincule sua conta do Discogs novamente em Configurações.",
      { status },
    );
  }
  if (status === 429) return new DiscogsErro("limite", "O Discogs limitou as requisições. Tente de novo em instantes.", { status });
  if (status === 400 || status === 422) return new DiscogsErro("requisicao_invalida", "O Discogs não aceitou a requisição.", { status });
  return new DiscogsErro("indisponivel", "O Discogs está indisponível no momento. Tente novamente em instantes.", { status });
}
