import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirArea } from "@/lib/auth";
import { aulasPrevistas, chaveAula, type Prevista } from "@/lib/aulas-previstas";
import { aulasLancadas, baseDoAno, menorData } from "@/lib/aulas-previstas-db";
import { eventosDoDia, TIPOS_EVENTO } from "@/lib/calendario";
import { diaDaSemana, hojeEmBrasilia, somarDias } from "@/lib/datas";

type Vinculo = { disciplina_id: number; professor_id: number | null; disciplinas: { nome: string; abreviacao: string | null } | null; professores: { nome: string } | null };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
function mesVizinho(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function CalendarioDaTurma({ params, searchParams }: PageProps<"/turmas/[id]/calendario">) {
  const { supabase } = await exigirArea("estrutura");
  const { id: bruto } = await params;
  const p = await searchParams;
  const id = Number(bruto);
  if (!Number.isInteger(id)) notFound();

  const [{ data: turma }, { data: vinculosBrutos }] = await Promise.all([
    supabase.from("turmas").select("id,nome,ano").eq("id", id).maybeSingle(),
    supabase
      .from("turma_disciplinas")
      .select("disciplina_id,professor_id,disciplinas(nome,abreviacao),professores(nome)")
      .eq("turma_id", id)
      .overrideTypes<Vinculo[], { merge: false }>(),
  ]);
  if (!turma) notFound();
  const vinculos = (vinculosBrutos ?? []).sort((a, b) => (a.disciplinas?.nome ?? "").localeCompare(b.disciplinas?.nome ?? ""));
  const nome = new Map(vinculos.map((v) => [v.disciplina_id, v.disciplinas?.abreviacao || v.disciplinas?.nome || "?"]));

  const base = await baseDoAno(supabase, turma.ano, [id]);
  const hoje = hojeEmBrasilia();
  if (!base) {
    return (
      <Cabecalho turma={turma}>
        <p className="mt-4 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
          Cadastre o início e o fim do ano letivo de {turma.ano} em{" "}
          <Link href={`/calendario?ano=${turma.ano}`} className="underline">
            Calendário
          </Link>{" "}
          para calcular as aulas.
        </p>
      </Cabecalho>
    );
  }

  const previstas = aulasPrevistas({ turmas: [id], slots: base.slots, eventos: base.eventos, de: base.inicio, ate: base.fim });
  const lancadas = await aulasLancadas(supabase, [id], base.inicio, menorData(base.fim, hoje));
  const ontem = somarDias(hoje, -1);

  // Resumo por disciplina: previstas no ano, por bimestre, até ontem, lançadas e pendentes.
  const resumo = vinculos.map((v) => {
    const daDisciplina = previstas.filter((a) => a.disciplina_id === v.disciplina_id);
    const ateOntem = daDisciplina.filter((a) => a.data <= ontem);
    const pendentes = ateOntem.filter((a) => !lancadas.has(chaveAula(a))).length;
    return {
      ...v,
      ano: daDisciplina.length,
      bimestres: base.bimestres.map((b) => daDisciplina.filter((a) => a.data >= b.inicio && a.data <= b.fim).length),
      ateOntem: ateOntem.length,
      lancadas: ateOntem.length - pendentes,
      pendentes,
    };
  });

  // Mês exibido: o pedido, ou o atual se estiver no ano letivo, ou o início do ano letivo.
  const mesPedido = typeof p.mes === "string" && /^\d{4}-\d{2}$/.test(p.mes) ? p.mes : null;
  const mes = mesPedido ?? (hoje >= base.inicio && hoje <= base.fim ? hoje.slice(0, 7) : base.inicio.slice(0, 7));
  const primeiro = `${mes}-01`;
  const ultimo = ultimoDiaDoMes(mes);
  const porDia = new Map<string, Prevista[]>();
  for (const a of previstas) {
    if (a.data < primeiro || a.data > ultimo) continue;
    porDia.set(a.data, [...(porDia.get(a.data) ?? []), a].sort((x, y) => x.aula_numero - y.aula_numero));
  }
  // Semanas de segunda a sábado (domingo não aparece).
  const semanas: (string | null)[][] = [];
  let semana: (string | null)[] = Array(6).fill(null);
  for (let d = primeiro; d <= ultimo; d = somarDias(d, 1)) {
    const dia = diaDaSemana(d);
    if (dia === 7) {
      if (semana.some(Boolean)) semanas.push(semana);
      semana = Array(6).fill(null);
      continue;
    }
    semana[dia - 1] = d;
  }
  if (semana.some(Boolean)) semanas.push(semana);
  const [anoMes, numMes] = mes.split("-").map(Number);

  return (
    <Cabecalho turma={turma}>
      {base.slots.length === 0 && (
        <p className="mt-4 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
          A turma ainda não tem horário semanal.{" "}
          <Link href={`/horarios?turma=${id}`} className="underline">
            Montar o horário
          </Link>
        </p>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Aulas por disciplina</h2>
        <div className="overflow-x-auto rounded-xl border border-borda bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-creme text-left text-xs text-texto-suave">
              <tr>
                <th className="px-3 py-2">Disciplina</th>
                <th className="px-2 py-2 text-right">No ano</th>
                {base.bimestres.map((b) => (
                  <th key={b.numero} className="px-2 py-2 text-right">
                    {b.numero}º bim.
                  </th>
                ))}
                <th className="px-2 py-2 text-right">Até ontem</th>
                <th className="px-2 py-2 text-right">Lançadas</th>
                <th className="px-3 py-2 text-right">Pendentes</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.disciplina_id} className="border-t border-borda">
                  <td className="px-3 py-1.5">
                    {r.disciplinas?.nome}
                    <span className="block text-[11px] text-texto-suave">{r.professores?.nome ?? "sem professor"}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold">{r.ano}</td>
                  {r.bimestres.map((n, i) => (
                    <td key={i} className="px-2 py-1.5 text-right">
                      {n}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">{r.ateOntem}</td>
                  <td className="px-2 py-1.5 text-right">{r.lancadas}</td>
                  <td className={`px-3 py-1.5 text-right ${r.pendentes ? "font-bold text-vinho" : ""}`}>{r.pendentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-texto-suave">
          Previstas = horário semanal × dias letivos do calendário (sem feriados e recessos; sábados letivos pelo dia indicado).
        </p>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <Link href={`/turmas/${id}/calendario?mes=${mesVizinho(mes, -1)}`} className="botao-secundario !px-3 !py-1.5" aria-label="Mês anterior">
            ‹
          </Link>
          <h2 className="flex-1 text-center font-titulo text-xl capitalize text-verde-escuro">
            {MESES[numMes - 1]} {anoMes}
          </h2>
          <Link href={`/turmas/${id}/calendario?mes=${mesVizinho(mes, 1)}`} className="botao-secundario !px-3 !py-1.5" aria-label="Próximo mês">
            ›
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-borda bg-white">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-xs">
            <thead className="bg-creme text-texto-suave">
              <tr>
                {DIAS.map((d) => (
                  <th key={d} className="px-2 py-1.5 text-left font-bold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanas.map((s, i) => (
                <tr key={i} className="border-t border-borda align-top">
                  {s.map((d, j) => {
                    if (!d) return <td key={j} className="bg-branco-quente/60" />;
                    const aulas = porDia.get(d) ?? [];
                    const eventos = eventosDoDia(base.eventos, d, id);
                    const fora = d < base.inicio || d > base.fim;
                    return (
                      <td key={j} className={`h-24 border-l border-borda px-1.5 py-1 ${fora ? "bg-branco-quente/60 text-texto-suave" : ""}`}>
                        <span className={`font-bold ${d === hoje ? "rounded bg-verde-escuro px-1 text-white" : "text-texto"}`}>{Number(d.slice(8))}</span>
                        {eventos.map((e) => (
                          <span key={e.id} className={`mt-0.5 block truncate ${e.letivo ? "text-dourado" : "text-vinho"}`} title={e.titulo}>
                            {TIPOS_EVENTO[e.tipo]?.rotulo ?? e.tipo}: {e.titulo}
                          </span>
                        ))}
                        <ul className="mt-0.5 space-y-px">
                          {aulas.map((a) => {
                            const feita = lancadas.has(chaveAula(a));
                            const cor = feita ? "text-verde-claro" : d <= somarDias(hoje, -1) ? "text-vinho" : "text-texto-suave";
                            return (
                              <li key={a.aula_numero} className={`truncate ${cor}`}>
                                {a.aula_numero}ª {nome.get(a.disciplina_id) ?? "?"}
                                {feita ? " ✓" : ""}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-texto-suave">
          <span className="text-verde-claro">✓ lançada</span> · <span className="text-vinho">pendente</span> · <span>a acontecer</span>
        </p>
      </section>
    </Cabecalho>
  );
}

function Cabecalho({ turma, children }: { turma: { id: number; nome: string; ano: number }; children: React.ReactNode }) {
  return (
    <div>
      <Link href={`/turmas/${turma.id}`} className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ {turma.nome}
      </Link>
      <h1 className="mt-2 font-titulo text-2xl text-verde-escuro sm:text-3xl">Calendário de aulas {turma.ano}</h1>
      <p className="mt-1 text-sm text-texto-suave">{turma.nome}</p>
      {children}
    </div>
  );
}
