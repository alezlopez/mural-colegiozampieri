import Link from "next/link";
import { notFound } from "next/navigation";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { adicionarDisciplina, alternarTurma, excluirTurma, salvarGrade, salvarTurma } from "../actions";
import { CamposTurma } from "../CamposTurma";

type Vinculo = { disciplina_id: number; professor_id: number | null; editado_no_painel: boolean; disciplinas: { nome: string } | null };

export default async function PaginaTurma({ params, searchParams }: PageProps<"/turmas/[id]">) {
  const { supabase } = await exigirAdmin();
  const { id: bruto } = await params;
  const p = await searchParams;
  const id = Number(bruto);
  if (!Number.isInteger(id)) notFound();

  const [{ data: turma }, { data: vinculosBrutos }, { data: professores }, { data: disciplinas }, { data: modelos }, { count: alunos }, { count: aulas }] =
    await Promise.all([
      supabase.from("turmas").select("id,nome,ano,segmento,turno,serie,letra,modelo_horario_id,ativa,mhund_id,editado_no_painel").eq("id", id).maybeSingle(),
      supabase
        .from("turma_disciplinas")
        .select("disciplina_id,professor_id,editado_no_painel,disciplinas(nome)")
        .eq("turma_id", id)
        .overrideTypes<Vinculo[], { merge: false }>(),
      supabase.from("professores").select("id,nome").eq("ativo", true).order("nome"),
      supabase.from("disciplinas").select("id,nome").eq("ativa", true).order("nome"),
      supabase.from("modelos_horario").select("id,nome").order("id"),
      supabase.from("matriculas").select("aluno_codigo", { count: "exact", head: true }).eq("turma_id", id).eq("ativa", true),
      supabase.from("aulas").select("id", { count: "exact", head: true }).eq("turma_id", id),
    ]);
  if (!turma) notFound();

  const vinculos = (vinculosBrutos ?? []).sort((a, b) => (a.disciplinas?.nome ?? "").localeCompare(b.disciplinas?.nome ?? ""));
  const naGrade = new Set(vinculos.map((v) => v.disciplina_id));
  const disponiveis = (disciplinas ?? []).filter((d) => !naGrade.has(d.id));
  const podeExcluir = !turma.mhund_id && !alunos && !aulas;

  return (
    <div>
      <Link href={`/turmas?ano=${turma.ano}`} className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ Turmas {turma.ano}
      </Link>
      <h1 className="mt-2 font-titulo text-2xl text-verde-escuro sm:text-3xl">{turma.nome}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        {turma.mhund_id ? "Ligada à Mhund" : "Criada no painel (ainda não ligada à Mhund)"}
        {turma.mhund_id && turma.editado_no_painel ? " · editada aqui (a sincronização não altera mais)" : ""} · {alunos ?? 0} aluno
        {alunos === 1 ? "" : "s"} · {aulas ?? 0} aula{aulas === 1 ? "" : "s"} lançada{aulas === 1 ? "" : "s"}
        {!turma.ativa && " · INATIVA"}
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border border-borda bg-white p-4">
          <h2 className="mb-3 font-titulo text-xl text-verde-escuro">Dados da turma</h2>
          <form action={salvarTurma} className="space-y-4">
            <input type="hidden" name="id" value={turma.id} />
            <CamposTurma turma={turma} ano={turma.ano} modelos={modelos ?? []} />
            <p className="text-xs text-texto-suave">
              Renomear atualiza junto a turma dos alunos no app e o público das publicações já feitas.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="botao-primario">Salvar</button>
              <Link href={`/horarios?turma=${turma.id}`} className="text-sm text-verde-claro underline-offset-4 hover:underline">
                Horário semanal ›
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-borda bg-white p-4">
          <h2 className="font-titulo text-xl text-verde-escuro">Disciplinas e professores ({vinculos.length})</h2>
          <p className="mt-1 text-xs text-texto-suave">
            Troque o professor ou marque &quot;retirar&quot; e salve. Só as linhas alteradas deixam de seguir a Mhund.
          </p>
          {vinculos.length > 0 && (
            <form action={salvarGrade} className="mt-3">
              <input type="hidden" name="turma_id" value={turma.id} />
              <ul className="divide-y divide-borda">
                {vinculos.map((v) => (
                  <li key={v.disciplina_id} className="grid gap-2 py-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
                    <input type="hidden" name="disciplina" value={v.disciplina_id} />
                    <input type="hidden" name={`atual_${v.disciplina_id}`} value={v.professor_id ?? ""} />
                    <span className="text-sm font-bold text-verde-escuro">
                      {v.disciplinas?.nome}
                      {v.editado_no_painel && <span className="ml-2 font-normal text-[11px] text-texto-suave">(painel)</span>}
                    </span>
                    <select
                      name={`prof_${v.disciplina_id}`}
                      defaultValue={v.professor_id ?? ""}
                      aria-label={`Professor de ${v.disciplinas?.nome}`}
                      className={`campo !py-1.5 ${v.professor_id ? "" : "!border-vinho/50"}`}
                    >
                      <option value="">Sem professor</option>
                      {(professores ?? []).map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.nome}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-vinho">
                      <input type="checkbox" name={`retirar_${v.disciplina_id}`} />
                      retirar
                    </label>
                  </li>
                ))}
              </ul>
              <button className="botao-primario mt-3">Salvar grade</button>
            </form>
          )}

          <form action={adicionarDisciplina} className="mt-4 grid gap-2 border-t border-borda pt-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <input type="hidden" name="turma_id" value={turma.id} />
            <label className="block">
              <span className="rotulo">Adicionar disciplina</span>
              <select name="disciplina_id" required defaultValue="" className="campo">
                <option value="" disabled>
                  Escolha…
                </option>
                {disponiveis.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="rotulo">Professor</span>
              <select name="professor_id" defaultValue="" className="campo">
                <option value="">Sem professor (definir depois)</option>
                {(professores ?? []).map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.nome}
                  </option>
                ))}
              </select>
            </label>
            <button className="botao-secundario">Adicionar</button>
          </form>
        </section>

        <section className="rounded-xl border border-borda bg-white p-4">
          <h2 className="font-titulo text-xl text-verde-escuro">Situação</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <form action={alternarTurma}>
              <input type="hidden" name="id" value={turma.id} />
              <input type="hidden" name="ativa" value={String(!turma.ativa)} />
              <button className="botao-secundario">{turma.ativa ? "Inativar turma" : "Reativar turma"}</button>
            </form>
            {podeExcluir && (
              <form action={excluirTurma}>
                <input type="hidden" name="id" value={turma.id} />
                <button className="text-sm text-vinho underline-offset-4 hover:underline">Excluir definitivamente</button>
              </form>
            )}
          </div>
          <p className="mt-2 text-xs text-texto-suave">
            Inativar tira a turma do diário, dos horários e das listas, e mantém o histórico.
            {!podeExcluir && " Excluir só é possível em turma criada no painel, sem alunos e sem aulas."}
          </p>
        </section>
      </div>
    </div>
  );
}
