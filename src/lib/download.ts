/** Baixa um arquivo gerado no navegador (UTF-8). */
export function baixarArquivo(nome: string, conteudo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê um arquivo de texto e avisa quando ele não parece estar em UTF-8 (acentos virariam "�"). */
export async function lerArquivoTexto(arquivo: File): Promise<{ texto: string; codificacaoSuspeita: boolean }> {
  const texto = await arquivo.text();
  return { texto, codificacaoSuspeita: texto.includes("\uFFFD") };
}
