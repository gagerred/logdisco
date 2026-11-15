import { compararNomes } from "@/lib/colecao/artistas";
import { identidadeDaImagem } from "@/lib/colecao/atualizacao";
import { normalizarTexto } from "@/lib/colecao/texto";
import { artistaDe } from "@/lib/colecao/artistas";
import type { ItemDiscogs } from "@/lib/sync/plano";
import type { AlbumDoc } from "@/lib/tipos";
import type { DesejoDoc } from "./tipos";

/** Formato como o Discogs informa: "Vinyl", "CD", "CD + DVD", "Cassette"… */
export const rotuloFormato = (d: Pick<DesejoDoc, "formatos">) => d.formatos.join(" + ") || "—";

/**
 * Desejos que aparecem na lista. Um disco que já consta na coleção ativa sai da lista de desejos
 * (a comparação é pelo ID do Release, ou seja, pela edição exata).
 */
export function desejosVisiveis(desejos: DesejoDoc[], colecaoAtiva: Pick<AlbumDoc, "id" | "status">[]): { visiveis: DesejoDoc[]; ocultos: number } {
  const naColecao = new Set(colecaoAtiva.filter((a) => a.status !== "removed").map((a) => a.id));
  const visiveis = desejos.filter((d) => !naColecao.has(d.id));
  return { visiveis, ocultos: desejos.length - visiveis.length };
}

/** Busca própria da lista de desejos: por artista ou título do álbum. */
export function buscarDesejos(desejos: DesejoDoc[], texto: string): DesejoDoc[] {
  const t = normalizarTexto(texto);
  if (!t) return desejos;
  return desejos.filter((d) => normalizarTexto(d.artista).includes(t) || normalizarTexto(d.titulo).includes(t) || d.artists.some((a) => normalizarTexto(a.name).includes(t)));
}

export type OrdemDesejos = "artista" | "album";

/** Ordem alfabética por artista (desempate pelo álbum) ou por álbum (desempate pelo artista). */
export function ordenarDesejos(desejos: DesejoDoc[], ordem: OrdemDesejos): DesejoDoc[] {
  const copia = [...desejos];
  return ordem === "album"
    ? copia.sort((a, b) => compararNomes(a.titulo, b.titulo) || compararNomes(a.artista, b.artista))
    : copia.sort((a, b) => compararNomes(a.artista, b.artista) || compararNomes(a.titulo, b.titulo));
}

/** Todos os desejos de um artista (um álbum com dois artistas aparece nos dois). */
export const desejosDoArtista = (desejos: DesejoDoc[], chave: string) => desejos.filter((d) => d.artistKeys.includes(chave));

/** Documento da lista de desejos a partir de um item da wantlist do Discogs. */
export function montarDesejo(i: ItemDiscogs) {
  const artists = i.artistas.length ? i.artistas.map((a) => artistaDe(a.id, a.name)) : [artistaDe(null, i.artista)];
  return {
    releaseId: i.id,
    titulo: i.titulo,
    artista: i.artista,
    artists,
    artistKeys: artists.map((a) => a.key),
    formatos: i.formatos,
    formatoOriginal: i.formatoOriginal,
    categoria: i.categoria,
    capa: i.capa,
    discogsUrl: `https://www.discogs.com/release/${i.id}`,
  };
}

export type ResultadoComparacaoWantlist = {
  adicionar: ReturnType<typeof montarDesejo>[];
  /** `visivel` indica uma mudança que o usuário percebe; renovar o endereço da capa não conta. */
  atualizar: { id: string; patch: Record<string, unknown>; visivel: boolean }[];
  remover: string[];
};

type Existente = Pick<DesejoDoc, "id" | "titulo" | "artista" | "formatos" | "formatoOriginal" | "categoria" | "capa" | "artistKeys" | "discogsUrl">;

/** Compara a wantlist do Discogs com a guardada. O resultado deixa a lista do LogDisco igual à do Discogs. */
export function compararWantlist(existentes: Existente[], doDiscogs: ItemDiscogs[]): ResultadoComparacaoWantlist {
  const novos = new Map<number, ItemDiscogs>();
  for (const i of doDiscogs) if (!novos.has(i.id)) novos.set(i.id, i);
  const atuais = new Map(existentes.map((e) => [e.id, e]));

  const resultado: ResultadoComparacaoWantlist = { adicionar: [], atualizar: [], remover: [] };
  for (const item of novos.values()) {
    const atual = atuais.get(String(item.id));
    const novo = montarDesejo(item);
    if (!atual) {
      resultado.adicionar.push(novo);
      continue;
    }
    const patch: Record<string, unknown> = {};
    let visivel = false;
    const mudou = (campo: keyof typeof novo, igual: boolean) => {
      if (!igual) {
        patch[campo] = novo[campo];
        visivel = true;
      }
    };
    mudou("titulo", atual.titulo === novo.titulo);
    mudou("artista", atual.artista === novo.artista);
    mudou("formatos", JSON.stringify(atual.formatos ?? []) === JSON.stringify(novo.formatos));
    mudou("formatoOriginal", atual.formatoOriginal === novo.formatoOriginal);
    mudou("categoria", (atual.categoria ?? null) === novo.categoria);
    if (JSON.stringify(atual.artistKeys ?? []) !== JSON.stringify(novo.artistKeys)) {
      patch.artists = novo.artists;
      patch.artistKeys = novo.artistKeys;
      visivel = true;
    }
    if (identidadeDaImagem(atual.capa) !== identidadeDaImagem(novo.capa)) {
      patch.capa = novo.capa;
      visivel = true;
    } else if (atual.capa !== novo.capa) {
      patch.capa = novo.capa; // mesma imagem, endereço renovado: sem aviso
    }
    if (atual.discogsUrl !== novo.discogsUrl) patch.discogsUrl = novo.discogsUrl;
    if (Object.keys(patch).length) resultado.atualizar.push({ id: atual.id, patch, visivel });
  }
  for (const id of atuais.keys()) if (!novos.has(Number(id))) resultado.remover.push(id);
  return resultado;
}
