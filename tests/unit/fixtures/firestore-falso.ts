import { FieldValue } from "firebase-admin/firestore";

/** Firestore em memória, com o mínimo da API do Admin SDK usado pelo app. */
type Dados = Record<string, unknown>;

const ehSentinela = (v: unknown, alvo: FieldValue) =>
  !!v && typeof v === "object" && typeof (v as FieldValue).isEqual === "function" && (v as FieldValue).isEqual(alvo);

/** Cópia profunda de objetos simples e listas; instâncias de classe (ex.: Timestamp) são mantidas. */
function clonar<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clonar) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clonar(x)])) as T;
  }
  return v;
}

function aplicar(destino: Dados, entrada: Dados) {
  for (const [k, v] of Object.entries(entrada)) {
    if (ehSentinela(v, FieldValue.delete())) delete destino[k];
    else if (ehSentinela(v, FieldValue.serverTimestamp())) destino[k] = { _servidor: true };
    else destino[k] = clonar(v);
  }
}

export class DocFalso {
  constructor(private db: BancoFalso, public path: string) {}
  get id() {
    return this.path.split("/").pop()!;
  }
  async get() {
    const d = this.db.dados.get(this.path);
    return { id: this.id, ref: this, exists: d !== undefined, data: () => (d === undefined ? undefined : clonar(d)) };
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
  async set(entrada: Dados, opcoes?: { merge?: boolean }) {
    this._set(entrada, opcoes);
  }
  async update(entrada: Dados) {
    this._update(entrada);
  }
}

type Filtro = { campo: string; op: "==" | "in"; valor: unknown };

class ConsultaFalsa {
  constructor(
    protected db: BancoFalso,
    protected pasta: string,
    protected filtros: Filtro[] = [],
    protected maximo?: number,
    protected ordem?: { campo: string; dir: "asc" | "desc" },
  ) {}
  where(campo: string, op: "==" | "in", valor: unknown) {
    return new ConsultaFalsa(this.db, this.pasta, [...this.filtros, { campo, op, valor }], this.maximo, this.ordem);
  }
  limit(n: number) {
    return new ConsultaFalsa(this.db, this.pasta, this.filtros, n, this.ordem);
  }
  /** Como no Firestore, documentos sem o campo ficam de fora de uma consulta ordenada por ele. */
  orderBy(campo: string, dir: "asc" | "desc" = "asc") {
    return new ConsultaFalsa(this.db, this.pasta, this.filtros, this.maximo, { campo, dir });
  }
  select(..._campos: string[]) {
    return this;
  }
  private encontrados() {
    const prefixo = this.pasta + "/";
    let lista = [...this.db.dados.entries()].filter(([p]) => p.startsWith(prefixo) && !p.slice(prefixo.length).includes("/"));
    for (const f of this.filtros) {
      lista = lista.filter(([, d]) => {
        const v = (d as Dados)[f.campo];
        return f.op === "==" ? v === f.valor : (f.valor as unknown[]).includes(v);
      });
    }
    if (this.ordem) {
      const { campo, dir } = this.ordem;
      lista = lista.filter(([, d]) => (d as Dados)[campo] !== undefined);
      lista.sort(([, a], [, b]) => {
        const x = (a as Dados)[campo] as number | string;
        const y = (b as Dados)[campo] as number | string;
        return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
      });
    } else {
      // Sem ordenação explícita, o Firestore devolve os documentos pelo ID.
      lista.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    }
    return this.maximo === undefined ? lista : lista.slice(0, this.maximo);
  }
  async get() {
    const docs = this.encontrados().map(([path, d]) => {
      const ref = new DocFalso(this.db, path);
      return { id: ref.id, ref, exists: true, data: () => clonar(d) as Dados };
    });
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
  count() {
    return { get: async () => ({ data: () => ({ count: this.encontrados().length }) }) };
  }
}

class ColecaoFalsa extends ConsultaFalsa {
  private auto = 0;
  doc(id?: string) {
    return new DocFalso(this.db, `${this.pasta}/${id ?? `auto${++this.db.contador}-${++this.auto}`}`);
  }
}

export class BancoFalso {
  dados = new Map<string, Dados>();
  /** Caminho de cada documento gravado, na ordem — permite provar o que NÃO foi tocado. */
  escritas: string[] = [];
  contador = 0;

  doc(path: string) {
    return new DocFalso(this, path);
  }
  collection(path: string) {
    return new ColecaoFalsa(this, path);
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
    this.dados.set(path, clonar(d));
  }
  sob(prefixo: string) {
    return [...this.dados.entries()].filter(([p]) => p.startsWith(prefixo));
  }
}
