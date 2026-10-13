import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirAdmin } from "@/lib/auth";
import { aulasPrevistas, chaveAula, type Prevista } from "@/lib/aulas-previstas";
import { aulasLancadas, baseDoAno, maiorData, menorData } from "@/lib/aulas-previstas-db";
import { formatarDataCurta, hojeEmBrasilia, somarDias } from "@/lib/datas";

type Vinculo = {
  turma_id: number;
  disciplina_id: number;
  professor_id: number | null;
  turmas: { nome: string } | null;
  disciplinas: { nome: string } | null;
  professores: { nome: string; user_id: string | null } | null;
};

const PERIODOS = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", ano: "Desde o início do ano" } as const;

export default async function AulasNaoLancadas({ searchParams }: PageProps<"/pendencias">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const periodo = (typeof p.periodo === "string" && p.periodo in PERIODOS ? p.periodo : "7") as keyof typeof PERIODOS;
  const letivo = await anoEmUso(supabase);

  const { data: turmas } = await supabase.from("turmas").select("id").eq("ano", letivo.ano).eq("ativa", true);
  const turmaIds = (turmas ?? []).map((t) => t.id as number);
  const base = await baseDoAno(supabase, letivo.ano, turmaIds);

  const cabecalho = (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex-1">
        <h1 className="font-titulo text-3xl text-verde-escuro">Aulas não lançadas</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Aulas previstas pelo horário e pelo calendário de {letivo.ano} que ainda não têm conteúdo lançado no diário (até ontem).
        </p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Período">
        {Object.entries(PERIODOS).map(([chave, rotulo]) => (
          <Link key={chave} href={`/pendencias?periodo=${chave}`} className={chave === periodo ? "botao-primario !px-3 !py-1.5" : "botao-secundario !px-3 !py-1.5"}>
            {rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );

  if (!base) {
    return (
      <div>
        {cabecalho}
        <p className="rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
          Cadastre o início e o fim do ano letivo de {letivo.ano} em{" "}
          <Link href={`/calendario?ano=${letivo.ano}`} className="underline">
            Calendário
          </Link>
          .
        </p>
      </div>
    );
  }

  const ontem = somarDias(hojeEmBrasilia(), -1);
  const ate = menorData(ontem, base.fim);
  const de = periodo === "ano" ? base.inicio : maiorData(base.inicio, somarDias(ontem, -(Number(periodo) - 1)));
  const antesDoInicio = ate < base.inicio;

  const [previstas, lancadas, { data: vinculosBrutos }] = await Promise.all([
    Promise.resolve(antesDoInicio ? [] : aulasPrevistas({ turmas: turmaIds, slots: base.slots, eventos: base.eventos, de, ate })),
    aulasLancadas(supabase, turmaIds, de, ate),
    supabase
      .from("turma_disciplinas")
      .select("turma_id,disciplina_id,professor_id,turmas(nome),disciplinas(nome),professores(nome,user_id)")
      .in("turma_id", turmaIds)
      .overrideTypes<Vinculo[], { merge: false }>(),
  ]);
  const vinculo = new Map((vinculosBrutos ?? []).map((v) => [`${v.turma_id}:${v.disciplina_id}`, v]));

  // Agrupa por professor e, dentro, por turma/disciplina.
  type Grupo = { chave: string; nome: string; semAcesso: boolean; previstas: number; pendentes: Map<string, { titulo: string; aulas: Prevista[] }> };
  const grupos = new Map<string, Grupo>();
  for (const a of previstas) {
    const v = vinculo.get(`${a.turma_id}:${a.disciplina_id}`);
    const chave = v?.professor_id ? String(v.professor_id) : "sem";
    const g =
      grupos.get(chave) ??
      ({
        chave,
        nome: v?.professores?.nome ?? "Sem professor atribuído",
        semAcesso: Boolean(v?.professor_id && !v.professores?.user_id),
        previstas: 0,
        pendentes: new Map(),
      } satisfies Grupo);
    g.previstas++;
    if (!lancadas.has(chaveAula(a))) {
      const k = `${a.turma_id}:${a.disciplina_id}`;
      const item = g.pendentes.get(k) ?? { titulo: `${v?.disciplinas?.nome ?? "?"} · ${v?.turmas?.nome ?? "?"}`, aulas: [] };
      item.aulas.push(a);
      g.pendentes.set(k, item);
    }
    grupos.set(chave, g);
  }
  const lista = [...grupos.values()]
    .map((g) => ({ ...g, totalPendentes: [...g.pendentes.values()].reduce((s, i) => s + i.aulas.length, 0) }))
    .sort((a, b) => b.totalPendentes - a.totalPendentes || a.nome.localeCompare(b.nome));
  const totalPrevistas = previstas.length;
  const totalPendentes = lista.reduce((s, g) => s + g.totalPendentes, 0);

  return (
    <div>
      {cabecalho}
      {antesDoInicio ? (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          O ano letivo de {letivo.ano} começa em {formatarDataCurta(base.inicio)}.
        </p>
      ) : totalPrevistas === 0 ? (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          Nenhuma aula prevista no período. Confira se os horários das turmas estão montados.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-texto">
            De {formatarDataCurta(de)} a {formatarDataCurta(ate)}: <strong>{totalPrevistas}</strong> aulas previstas,{" "}
            <strong className={totalPendentes ? "text-vinho" : "text-verde-claro"}>{totalPendentes} sem lançamento</strong> (
            {Math.round(((totalPrevistas - totalPendentes) / totalPrevistas) * 100)}% lançadas).
          </p>
          <ul className="space-y-3">
            {lista.map((g) => (
              <li key={g.chave}>
                <details className="rounded-xl border border-borda bg-white" open={g.totalPendentes > 0 && lista.length <= 5}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                    <span className="font-titulo text-lg text-verde-escuro">{g.nome}</span>
                    {g.semAcesso && <span className="text-xs font-bold text-dourado">SEM ACESSO AO DIÁRIO</span>}
                    <span className={`ml-auto text-sm font-bold ${g.totalPendentes ? "text-vinho" : "text-verde-claro"}`}>
                      {g.totalPendentes ? `${g.totalPendentes} pendente${g.totalPendentes === 1 ? "" : "s"}` : "em dia ✓"}
                    </span>
                    <span className="text-xs text-texto-suave">
                      {Math.round(((g.previstas - g.totalPendentes) / g.previstas) * 100)}% de {g.previstas}
                    </span>
                  </summary>
                  {g.totalPendentes > 0 && (
                    <ul className="divide-y divide-borda border-t border-borda">
                      {[...g.pendentes.values()].map((item) => (
                        <li key={item.titulo} className="px-4 py-2 text-sm">
                          <span className="font-bold text-texto">{item.titulo}</span>
                          <span className="ml-2 text-xs text-texto-suave">({item.aulas.length})</span>
                          <span className="mt-0.5 block text-xs capitalize text-texto-suave">
                            {item.aulas
                              .sort((x, y) => x.data.localeCompare(y.data) || x.aula_numero - y.aula_numero)
                              .map((a) => `${formatarDataCurta(a.data)} (${a.aula_numero}ª)`)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
