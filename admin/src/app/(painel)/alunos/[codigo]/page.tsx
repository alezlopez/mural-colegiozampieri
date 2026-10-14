import { notFound } from "next/navigation";
import Link from "next/link";
import { FREQUENCIA_MINIMA, frequenciaDoAno, presenca } from "@/lib/acompanhamento";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirArea } from "@/lib/auth";
import { formatarNota } from "@/lib/avaliacao";
import { boletimDaTurma } from "@/lib/boletim";
import { exibirTelefone } from "@/lib/telefone";

type Matricula = { turma_id: number; ano: number; situacao: string | null; ativa: boolean; numero_chamada: number | null; turmas: { nome: string } | null };

export default async function FichaDoAluno({ params }: PageProps<"/alunos/[codigo]">) {
  const { supabase } = await exigirArea("acompanhamento");
  const { codigo } = await params;
  const { ano } = await anoEmUso(supabase);

  const [{ data: aluno }, { data: matriculas }, { data: responsaveis }, freq] = await Promise.all([
    supabase.from("alunos").select("codigo,nome,ativo").eq("codigo", codigo).maybeSingle(),
    supabase
      .from("matriculas")
      .select("turma_id,ano,situacao,ativa,numero_chamada,turmas(nome)")
      .eq("aluno_codigo", codigo)
      .order("ano", { ascending: false })
      .overrideTypes<Matricula[], { merge: false }>(),
    supabase.from("aluno_responsaveis").select("nome,telefone").eq("aluno_codigo", codigo).order("nome"),
    frequenciaDoAno(supabase, ano, codigo),
  ]);
  if (!aluno) notFound();

  const atual = (matriculas ?? []).find((m) => m.ano === ano && m.ativa);
  const boletim = atual ? await boletimDaTurma(supabase, atual.turma_id, [codigo]) : null;
  const linhas = boletim?.alunos[0]?.linhas ?? [];
  const regra = boletim?.regra;

  // Presença por disciplina no ano (todas as turmas do ano, se trocou de turma).
  const porDisc = new Map<number, { aulas: number; ausencias: number }>();
  for (const f of freq) {
    const d = porDisc.get(f.disciplina_id) ?? { aulas: 0, ausencias: 0 };
    d.aulas += f.aulas;
    d.ausencias += f.faltas + f.justificadas;
    porDisc.set(f.disciplina_id, d);
  }
  const total = [...porDisc.values()].reduce((s, d) => ({ aulas: s.aulas + d.aulas, ausencias: s.ausencias + d.ausencias }), { aulas: 0, ausencias: 0 });
  const geral = presenca(total.aulas, total.ausencias);

  return (
    <div>
      <Link href="/alunos" className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ Buscar outro aluno
      </Link>
      <h1 className="mt-2 font-titulo text-3xl text-verde-escuro">{aluno.nome}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Código {aluno.codigo}
        {!aluno.ativo && <strong className="text-vinho"> · INATIVO</strong>}
        {atual ? (
          <>
            {" "}
            ·{" "}
            <Link href={`/turmas/${atual.turma_id}`} className="underline-offset-4 hover:underline">
              {atual.turmas?.nome}
            </Link>
            {atual.numero_chamada ? ` · nº ${atual.numero_chamada}` : ""}
          </>
        ) : (
          ` · sem turma em ${ano}`
        )}
        {geral !== null && (
          <>
            {" "}
            · presença no ano <strong className={geral < FREQUENCIA_MINIMA ? "text-vinho" : "text-verde-escuro"}>{geral.toString().replace(".", ",")}%</strong>
          </>
        )}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Notas e frequência {ano}</h2>
          {!atual ? (
            <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Sem matrícula ativa em {ano}.</p>
          ) : linhas.length === 0 ? (
            <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">A turma ainda não tem disciplinas.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-borda bg-white">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-creme text-left text-xs text-texto-suave">
                  <tr>
                    <th className="px-3 py-2">Disciplina</th>
                    {[1, 2, 3, 4].map((b) => (
                      <th key={b} className="px-2 py-2 text-center">
                        {b}º
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center">Anual</th>
                    <th className="px-2 py-2 text-right">Faltas</th>
                    <th className="px-3 py-2 text-right">Presença</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const d = porDisc.get(l.disciplina_id);
                    const p = d ? presenca(d.aulas, d.ausencias) : null;
                    return (
                      <tr key={l.disciplina_id} className="border-t border-borda">
                        <td className="px-3 py-1.5">{l.disciplina}</td>
                        {l.bimestres.map((b, i) => {
                          const nota = b.resultado.final ?? b.resultado.parcial;
                          const baixa = regra && !regra.descritivo && nota !== null && nota < regra.media_aprovacao;
                          return (
                            <td key={i} className={`px-2 py-1.5 text-center ${baixa ? "font-bold text-vinho" : ""}`} title={b.parecer ?? undefined}>
                              {regra?.descritivo ? (b.parecer ? "✓" : "—") : formatarNota(nota)}
                              {b.resultado.final === null && b.resultado.parcial !== null && <span className="text-[10px] text-texto-suave">*</span>}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-center">{regra?.descritivo ? "—" : formatarNota(l.anual.media ?? l.anual.parcial)}</td>
                        <td className="px-2 py-1.5 text-right">{l.faltasNoAno}</td>
                        <td className={`px-3 py-1.5 text-right ${p !== null && p < FREQUENCIA_MINIMA ? "font-bold text-vinho" : ""}`}>
                          {p === null ? "—" : `${p.toString().replace(".", ",")}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="border-t border-borda px-3 py-2 text-[11px] text-texto-suave">
                * parcial: ainda faltam avaliações no bimestre. Presença sobre as aulas com chamada até agora.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Responsáveis</h2>
            <ul className="divide-y divide-borda rounded-xl border border-borda bg-white text-sm">
              {(responsaveis ?? []).length === 0 && <li className="p-3 text-texto-suave">Nenhum cadastrado.</li>}
              {(responsaveis ?? []).map((r) => (
                <li key={r.telefone} className="p-3">
                  {r.nome ?? "—"}
                  <a href={`https://wa.me/${r.telefone}`} target="_blank" rel="noreferrer" className="block text-xs text-verde-claro underline-offset-4 hover:underline">
                    {exibirTelefone(r.telefone)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Matrículas</h2>
            <ul className="divide-y divide-borda rounded-xl border border-borda bg-white text-sm">
              {(matriculas ?? []).map((m) => (
                <li key={`${m.ano}:${m.turma_id}`} className={`flex gap-2 p-3 ${m.ativa ? "" : "text-texto-suave"}`}>
                  <span className="w-12 font-bold">{m.ano}</span>
                  <span className="flex-1">{m.turmas?.nome ?? "?"}</span>
                  <span className="text-xs">{m.ativa ? "ativa" : m.situacao ? `situação ${m.situacao}` : "saiu da turma"}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
