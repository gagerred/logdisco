/** Erro previsto de regra do app (duplicado, entrada inválida...), com status HTTP e código. */
export class ErroNegocio extends Error {
  constructor(
    public codigo: string,
    mensagem: string,
    public status: number,
    public extra: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}
