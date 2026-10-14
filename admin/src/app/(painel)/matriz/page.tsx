import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { exigirArea } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/datas";
import { SEGMENTOS } from "@/lib/segmentos";
import { salvarMatriz } from "./actions";

type Turma = { id: number; nome: string; ano: number; segmento: string; serie: string | null; turma_disciplinas: { disciplina_id: number }[] };
type Linha = { segmento: string; serie: string; disciplina_id: number; aulas_semanais: number | null };

const ORDEM = Object.keys(SEGMENTOS);
const ancoraDe = (segmento: string, serie: string) => `${segmento}-${serie}`.normalize("NFD").replace(/[^\w-]+/g, "-").toLowerCase();

export default async function PaginaMatriz({ searchParams }: PageProps<"/matriz">) {
  const { supabase } = await exigirArea("estrutura");
  const p = await searchParams;

  const { data: anosBrutos } = await supabase.from("turmas").select("ano").eq("ativa", true);
  const anoAtual = Number(hojeEmBrasilia().slice(0, 4));
  const ano = Number(p.ano) || Math.max(anoAtual, ...(anosBrutos ?? []).map((t) => t.ano as number));

  const [{ data: turmasBrutas }, { data: matriz }, { data: disciplinas }] = await Promise.all([
    supabase
      .from("turmas")
      .select("id,nome,ano,segmento,serie,turma_disciplinas(disciplina_id)")
      .in("ano", [ano, ano - 1])
      .eq("ativa", true)
      .order("nome")
      .overrideTypes<Turma[], { merge: false }>(),
    supabase.from("matriz_curricular").select("segmento,serie,disciplina_id,aulas_semanais").eq("ano", ano).overrideTypes<Linha[], { merge: false }>(),
    supabase.from("disciplinas").select("id,nome").eq("ativa", true).order("nome"),
  ]);
  const turmas = (turmasBrutas ?? []).filter((t) => t.ano === ano);
  const anterior = (turmasBrutas ?? []).filter((t) => t.ano === ano - 1);

  // Séries do ano = segmento + série das turmas, na ordem dos segmentos e do nome da primeira turma.
  const series = new Map<string, { segmento: string; serie: string; turmas: Turma[] }>();
  for (const t of turmas) {
    if (!t.serie) continue;
    const chave = `${t.segmento}|${t.serie}`;
    const s = series.get(chave) ?? { segmento: t.segmento, serie: t.serie, turmas: [] };
    s.turmas.push(t);
    series.set(chave, s);
  }
  const lista = [...series.values()].sort(
    (a, b) => ORDEM.indexOf(a.segmento) - ORDEM.indexOf(b.segmento) || a.turmas[0].nome.localeCompare(b.turmas[0].nome, "pt-BR", { numeric: true }),
  );
  const semSerie = turmas.filter((t) => !t.serie);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-titulo text-3xl text-verde-escuro">Matriz curricular {ano}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            As disciplinas de cada série e quantas aulas por semana. Ao salvar, a matriz é aplicada a todas as turmas da
            série (sem professor; atribua depois em Turmas ou Professores). Sem matriz salva, a sugestão vem da grade de{" "}
            {ano - 1}.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Ano">
          <Link href={`/matriz?ano=${ano - 1}`} className="botao-secundario !px-3">
            ‹ {ano - 1}
          </Link>
          <Link href={`/matriz?ano=${ano + 1}`} className="botao-secundario !px-3">
            {ano + 1} ›
          </Link>
        </nav>
      </div>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      {lista.length === 0 && (
        <p className="mt-4 rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          Nenhuma turma com série em {ano}.
        </p>
      )}
      {semSerie.length > 0 && (
        <p className="mt-4 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
          {semSerie.length} turma(s) sem série não entram na matriz: {semSerie.map((t) => t.nome).join("; ")}. Preencha a série
          na tela da turma.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {lista.map((s) => {
          const ancora = ancoraDe(s.segmento, s.serie);
          const daSerie = (matriz ?? []).filter((m) => m.segmento === s.segmento && m.serie === s.serie);
          const salva = daSerie.length > 0;
          // Sugestão: disciplinas que as turmas da mesma série tinham no ano anterior.
          const sugeridas = new Set(
            anterior.filter((t) => t.segmento === s.segmento && t.serie === s.serie).flatMap((t) => t.turma_disciplinas.map((v) => v.disciplina_id)),
          );
          const marcada = (d: number) => (salva ? daSerie.some((m) => m.disciplina_id === d) : sugeridas.has(d));
          const aulas = (d: number) => daSerie.find((m) => m.disciplina_id === d)?.aulas_semanais ?? "";
          const total = daSerie.reduce((soma, m) => soma + (m.aulas_semanais ?? 0), 0);
          const turmasIncompletas = s.turmas.filter(
            (t) => salva && daSerie.some((m) => !t.turma_disciplinas.some((v) => v.disciplina_id === m.disciplina_id)),
          ).length;

          return (
            <details key={ancora} id={ancora} className="rounded-xl border border-borda bg-white" open={!salva}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                <span className="text-[11px] font-bold tracking-wider text-texto-suave uppercase">{SEGMENTOS[s.segmento]}</span>
                <span className="font-titulo text-xl text-verde-escuro">{s.serie}</span>
                <span className="text-xs text-texto-suave">
                  {s.turmas.length} turma{s.turmas.length === 1 ? "" : "s"}
                </span>
                <span className={`ml-auto text-xs font-bold ${salva ? "text-verde-claro" : "text-dourado"}`}>
                  {salva ? `${daSerie.length} disciplinas${total ? ` · ${total} aulas/semana` : ""}` : "SUGESTÃO — REVISE E SALVE"}
                </span>
                {turmasIncompletas > 0 && <span className="text-xs font-bold text-vinho">{turmasIncompletas} turma(s) fora da matriz</span>}
              </summary>
              <form action={salvarMatriz} className="border-t border-borda p-4">
                <input type="hidden" name="ano" value={ano} />
                <input type="hidden" name="segmento" value={s.segmento} />
                <input type="hidden" name="serie" value={s.serie} />
                <input type="hidden" name="ancora" value={ancora} />
                <p className="mb-3 text-xs text-texto-suave">Turmas: {s.turmas.map((t) => t.nome).join("; ")}</p>
                <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {(disciplinas ?? []).map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="disciplina" value={d.id} defaultChecked={marcada(d.id)} />
                      <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                      <input
                        type="number"
                        name={`aulas_${d.id}`}
                        min={1}
                        max={20}
                        defaultValue={aulas(d.id)}
                        placeholder="aulas"
                        aria-label={`Aulas por semana de ${d.nome}`}
                        className="w-16 rounded border border-borda px-1.5 py-1 text-xs"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-2 text-xs text-texto-suave">
                  <input type="checkbox" name="retirar_extras" defaultChecked />
                  Retirar das turmas as disciplinas que não estão na matriz (as que já têm aula lançada são mantidas)
                </label>
                <button className="botao-primario mt-3">
                  Salvar e aplicar a {s.turmas.length} turma{s.turmas.length === 1 ? "" : "s"}
                </button>
              </form>
            </details>
          );
        })}
      </div>
    </div>
  );
}
