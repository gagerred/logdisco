import { FieldValue } from "firebase-admin/firestore";

/** Firestore em memória, com o mínimo da API do Admin SDK usado pelo app. */
type Dados = Record<string, unknown>;

const ehSentinela = (v: unknown, alvo: FieldValue) =>
  !!v && typeof v === "object" && typeof (v as FieldValue).isEqual === "function" && (v as FieldValue).isEqual(alvo);

function aplicar(destino: Dados, entrada: Dados) {
  for (const [k, v] of Object.entries(entrada)) {
    if (ehSentinela(v, FieldValue.delete())) delete destino[k];
    else if (ehSentinela(v, FieldValue.serverTimestamp())) destino[k] = { _servidor: true };
    else destino[k] = structuredClone(v);
  }
}

export class DocFalso {
  constructor(private db: BancoFalso, public path: string) {}
  async get() {
    const d = this.db.dados.get(this.path);
    return { exists: d !== undefined, data: () => (d === undefined ? undefined : structuredClone(d)) };
  }
  _set(entrada: Dados, opcoes?: { merge?: boolean }) {
    const atual = opcoes?.merge ? (this.db.dados.get(this.path) ?? {}) : {};
    aplicar(atual, entrada);
    this.db.dados.set(this.path, atual);
    this.db.escritas.push(this.path);
  }
  _update(entrada: Dados) {
    const atual = this.db.dados.get(this.path);
    if (!atual) throw new Error(`update em documento inexistente: ${this.path}`);
    aplicar(atual, entrada);
    this.db.escritas.push(this.path);
  }
  _delete() {
    this.db.dados.delete(this.path);
    this.db.escritas.push(this.path);
  }
  update(entrada: Dados) {
    this._update(entrada);
  }
}

export class BancoFalso {
  dados = new Map<string, Dados>();
  /** Caminho de cada documento gravado, na ordem — permite provar o que NÃO foi tocado. */
  escritas: string[] = [];
  private auto = 0;

  doc(path: string) {
    return new DocFalso(this, path);
  }
  collection(path: string) {
    return { doc: (id?: string) => new DocFalso(this, `${path}/${id ?? `auto${++this.auto}`}`) };
  }
  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const ops: (() => void)[] = [];
    const tx = {
      get: (ref: DocFalso) => ref.get(),
      set: (ref: DocFalso, d: Dados, o?: { merge?: boolean }) => ops.push(() => ref._set(d, o)),
      update: (ref: DocFalso, d: Dados) => ops.push(() => ref._update(d)),
    };
    const r = await fn(tx);
    ops.forEach((op) => op());
    return r;
  }
  batch() {
    const ops: (() => void)[] = [];
    return {
      set: (ref: DocFalso, d: Dados, o?: { merge?: boolean }) => void ops.push(() => ref._set(d, o)),
      update: (ref: DocFalso, d: Dados) => void ops.push(() => ref._update(d)),
      delete: (ref: DocFalso) => void ops.push(() => ref._delete()),
      commit: async () => ops.forEach((op) => op()),
    };
  }
  semear(path: string, d: Dados) {
    this.dados.set(path, structuredClone(d));
  }
  sob(prefixo: string) {
    return [...this.dados.entries()].filter(([p]) => p.startsWith(prefixo));
  }
}
