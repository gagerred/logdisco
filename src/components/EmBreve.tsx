/** Página provisória de uma seção cujo conteúdo será implementado em uma etapa posterior. */
export function EmBreve({ titulo, etapa, descricao }: { titulo: string; etapa: number; descricao: string }) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-verde-950 md:text-3xl">{titulo}</h1>
      <div className="painel mt-5">
        <p className="text-base">{descricao}</p>
        <p className="mt-3 text-sm text-verde-700">Esta seção será implementada na Etapa {etapa} do desenvolvimento.</p>
      </div>
    </section>
  );
}
