import Link from "next/link";
import { notFound } from "next/navigation";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { alternarAtivo, atribuirVinculo, excluirProfessor, removerVinculo, salvarProfessor } from "../actions";
import { BotaoAcesso } from "../BotaoAcesso";

type Vinculo = {
  turma_id: number;
  disciplina_id: number;
  turmas: { nome: string; ano: number; ativa: boolean } | null;
  disciplinas: { nome: string } | null;
};
type Turma = { id: number; nome: string; ano: number; segmento: string };

const SEGMENTOS: Record<string, string> = {
  infantil: "Educação Infantil",
  fundamental1: "Fundamental I",
  fundamental2: "Fundamental II",
  medio: "Ensino Médio",
};

export default async function PaginaProfessor({ params, searchParams }: PageProps<"/professores/[id]">) {
  const { supabase } = await exigirAdmin();
  const { id: bruto } = await params;
  const p = await searchParams;
  const id = Number(bruto);
  if (!Number.isInteger(id)) notFound();

  const [{ data: professor }, { data: vinculosBrutos }, { data: turmasBrutas }, { data: disciplinas }, { count: aulasLancadas }] =
    await Promise.all([
      supabase.from("professores").select("id,nome,email,user_id,ativo,mhund_id,editado_no_painel").eq("id", id).maybeSingle(),
      supabase
        .from("turma_disciplinas")
        .select("turma_id,disciplina_id,turmas(nome,ano,ativa),disciplinas(nome)")
        .eq("professor_id", id)
        .overrideTypes<Vinculo[], { merge: false }>(),
      supabase.from("turmas").select("id,nome,ano,segmento").eq("ativa", true).order("nome").overrideTypes<Turma[], { merge: false }>(),
      supabase.from("disciplinas").select("id,nome").eq("ativa", true).order("nome"),
      supabase.from("aulas").select("id", { count: "exact", head: true }).eq("professor_id", id),
    ]);
  if (!professor) notFound();

  const anoAtual = Math.max(0, ...(turmasBrutas ?? []).map((t) => t.ano));
  const turmas = (turmasBrutas ?? []).filter((t) => t.ano === anoAtual);
  const vinculos = (vinculosBrutos ?? [])
    .filter((v) => v.turmas?.ativa)
    .sort((a, b) => (a.disciplinas?.nome ?? "").localeCompare(b.disciplinas?.nome ?? "") || (a.turmas?.nome ?? "").localeCompare(b.turmas?.nome ?? ""));
  const porDisciplina = new Map<string, Vinculo[]>();
  for (const v of vinculos) {
    const chave = v.disciplinas?.nome ?? "?";
    porDisciplina.set(chave, [...(porDisciplina.get(chave) ?? []), v]);
  }
  return (
    <div>
      <Link href="/professores" className="text-sm text-verde-claro underline-offset-4 hover:underline">
        ‹ Professores
      </Link>
      <h1 className="mt-2 font-titulo text-3xl text-verde-escuro">{professor.nome}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        {professor.mhund_id ? "Veio da Mhund" : "Cadastrado no painel"}
        {professor.mhund_id && professor.editado_no_painel ? " · editado aqui (a sincronização não altera mais)" : ""}
        {!professor.ativo && " · INATIVO (sem acesso ao diário)"}
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-borda bg-white p-4">
            <h2 className="font-titulo text-xl text-verde-escuro">Dados</h2>
            <form action={salvarProfessor} className="mt-3 space-y-3">
              <input type="hidden" name="professor_id" value={professor.id} />
              <label className="block">
                <span className="rotulo">Nome</span>
                <input name="nome" defaultValue={professor.nome} required maxLength={120} className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">E-mail (login do diário)</span>
                <input name="email" type="email" defaultValue={professor.email ?? ""} className="campo" />
              </label>
              {professor.user_id && <p className="text-xs text-texto-suave">Trocar o e-mail troca também o login do professor.</p>}
              <button className="botao-primario">Salvar</button>
            </form>
          </div>

          <div className="rounded-xl border border-borda bg-white p-4">
            <h2 className="font-titulo text-xl text-verde-escuro">Acesso</h2>
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {professor.ativo && <BotaoAcesso professorId={professor.id} temAcesso={Boolean(professor.user_id)} email={professor.email} />}
              <form action={alternarAtivo}>
                <input type="hidden" name="professor_id" value={professor.id} />
                <input type="hidden" name="ativo" value={String(!professor.ativo)} />
                <button className="botao-secundario">{professor.ativo ? "Inativar" : "Reativar"}</button>
              </form>
            </div>
            <p className="mt-3 text-xs text-texto-suave">
              Inativar bloqueia o acesso ao diário e mantém o histórico das aulas.
              {!professor.mhund_id && !aulasLancadas ? " Como ele nunca lançou aula, também pode ser excluído." : ""}
            </p>
            {!professor.mhund_id && !aulasLancadas && (
              <form action={excluirProfessor} className="mt-2">
                <input type="hidden" name="professor_id" value={professor.id} />
                <button className="text-xs text-vinho underline-offset-4 hover:underline">Excluir definitivamente</button>
              </form>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-borda bg-white p-4">
            <h2 className="font-titulo text-xl text-verde-escuro">Atribuir disciplina</h2>
            <p className="mt-1 text-xs text-texto-suave">
              Se outro professor já dá essa disciplina na turma, ele é substituído por este.
            </p>
            <form action={atribuirVinculo} className="mt-3 space-y-3">
              <input type="hidden" name="professor_id" value={professor.id} />
              <label className="block">
                <span className="rotulo">Disciplina</span>
                <select name="disciplina_id" required defaultValue="" className="campo">
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {(disciplinas ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className="rotulo">Turmas {anoAtual || ""}</legend>
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-borda p-2">
                  {Object.entries(SEGMENTOS).map(([seg, rotulo]) => {
                    const doSeg = turmas.filter((t) => t.segmento === seg);
                    if (doSeg.length === 0) return null;
                    return (
                      <div key={seg}>
                        <p className="mb-1 text-[11px] font-bold tracking-wider text-texto-suave uppercase">{rotulo}</p>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {doSeg.map((t) => (
                            <label key={t.id} className="flex items-center gap-2 text-xs">
                              <input type="checkbox" name="turma_id" value={t.id} />
                              {t.nome}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <button className="botao-primario">Atribuir</button>
            </form>
          </div>

          <div>
            <h2 className="rotulo">Dá aula de ({vinculos.length})</h2>
            {vinculos.length === 0 ? (
              <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Nenhuma disciplina atribuída.</p>
            ) : (
              <div className="space-y-3">
                {[...porDisciplina].map(([disciplina, lista]) => (
                  <div key={disciplina} className="rounded-xl border border-borda bg-white">
                    <p className="border-b border-borda px-3 py-2 text-sm font-bold text-verde-escuro">{disciplina}</p>
                    <ul className="divide-y divide-borda">
                      {lista.map((v) => (
                        <li key={`${v.turma_id}-${v.disciplina_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1">{v.turmas?.nome}</span>
                          <form action={removerVinculo}>
                            <input type="hidden" name="professor_id" value={professor.id} />
                            <input type="hidden" name="turma_id" value={v.turma_id} />
                            <input type="hidden" name="disciplina_id" value={v.disciplina_id} />
                            <input type="hidden" name="modo" value="sem_professor" />
                            <button className="text-xs text-verde-claro underline-offset-4 hover:underline" title="A disciplina continua na turma, sem professor">
                              Tirar deste professor
                            </button>
                          </form>
                          <form action={removerVinculo}>
                            <input type="hidden" name="professor_id" value={professor.id} />
                            <input type="hidden" name="turma_id" value={v.turma_id} />
                            <input type="hidden" name="disciplina_id" value={v.disciplina_id} />
                            <button className="text-xs text-vinho underline-offset-4 hover:underline" title="A turma deixa de ter essa disciplina (sai também do horário)">
                              Retirar da turma
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
