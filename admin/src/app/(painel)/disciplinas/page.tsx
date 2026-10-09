import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { alternarDisciplina, criarDisciplina, excluirDisciplina, salvarDisciplina } from "./actions";

type Disciplina = {
  id: number;
  nome: string;
  abreviacao: string | null;
  ativa: boolean;
  mhund_id: number | null;
  turma_disciplinas: { professor_id: number | null; turmas: { ativa: boolean } | null }[];
};

export default async function PaginaDisciplinas({ searchParams }: PageProps<"/disciplinas">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const { data, error } = await supabase
    .from("disciplinas")
    .select("id,nome,abreviacao,ativa,mhund_id,turma_disciplinas(professor_id,turmas(ativa))")
    .order("ativa", { ascending: false })
    .order("nome")
    .overrideTypes<Disciplina[], { merge: false }>();
  const disciplinas = data ?? [];

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Disciplinas</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Vêm da Mhund e também podem ser cadastradas aqui. O que você edita no painel a sincronização não desfaz.
        Disciplina já usada não é apagada: inative, e o histórico das aulas fica preservado.
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <form action={criarDisciplina} className="mt-6 grid gap-3 rounded-xl border border-borda bg-white p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <label className="block">
          <span className="rotulo">Nova disciplina</span>
          <input name="nome" required maxLength={80} placeholder="Ex.: Robótica" className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Abreviação</span>
          <input name="abreviacao" maxLength={12} placeholder="ROB" className="campo" />
        </label>
        <button className="botao-primario">Cadastrar</button>
      </form>

      {error && <p className="mt-4 text-sm text-vinho">Não foi possível carregar as disciplinas.</p>}

      <ul className="mt-6 divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
        {disciplinas.map((d) => {
          const vinculos = d.turma_disciplinas.filter((v) => v.turmas?.ativa);
          const semProfessor = vinculos.filter((v) => !v.professor_id).length;
          return (
            <li key={d.id} className={`p-4 ${d.ativa ? "" : "opacity-55"}`}>
              <form action={salvarDisciplina} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={d.id} />
                <label className="min-w-48 flex-1">
                  <span className="sr-only">Nome</span>
                  <input name="nome" defaultValue={d.nome} required maxLength={80} className="campo !py-1.5" />
                </label>
                <label className="w-24">
                  <span className="sr-only">Abreviação</span>
                  <input name="abreviacao" defaultValue={d.abreviacao ?? ""} maxLength={12} className="campo !py-1.5" />
                </label>
                <button className="botao-secundario !px-3 !py-1.5">Salvar</button>
              </form>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
                <span>
                  {vinculos.length} turma{vinculos.length === 1 ? "" : "s"}
                  {semProfessor > 0 && <strong className="text-vinho"> · {semProfessor} sem professor</strong>}
                </span>
                <span>{d.mhund_id ? "Mhund" : "cadastrada no painel"}</span>
                {!d.ativa && <strong>INATIVA</strong>}
                <form action={alternarDisciplina} className="ml-auto">
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="ativa" value={String(!d.ativa)} />
                  <button className="underline-offset-4 hover:underline">{d.ativa ? "Inativar" : "Reativar"}</button>
                </form>
                {!d.mhund_id && vinculos.length === 0 && (
                  <form action={excluirDisciplina}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="text-vinho underline-offset-4 hover:underline">Excluir</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
