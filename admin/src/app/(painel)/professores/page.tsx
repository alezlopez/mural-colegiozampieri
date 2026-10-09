import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { alternarAtivo, criarProfessor } from "./actions";
import { BotaoAcesso } from "./BotaoAcesso";

type Linha = {
  id: number;
  nome: string;
  email: string | null;
  user_id: string | null;
  ativo: boolean;
  mhund_id: number | null;
  turma_disciplinas: { turmas: { nome: string } | null; disciplinas: { nome: string } | null }[];
};

export default async function PaginaProfessores({ searchParams }: PageProps<"/professores">) {
  const { supabase } = await exigirAdmin();
  const sp = await searchParams;
  const { data, error } = await supabase
    .from("professores")
    .select("id,nome,email,user_id,ativo,mhund_id,turma_disciplinas(turmas(nome),disciplinas(nome))")
    .order("ativo", { ascending: false })
    .order("nome")
    .overrideTypes<Linha[], { merge: false }>();
  const professores = data ?? [];
  const comAcesso = professores.filter((p) => p.user_id).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-titulo text-3xl text-verde-escuro">Professores</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Vêm da Mhund e também podem ser cadastrados aqui. O que você edita no painel a sincronização não desfaz.
          Crie o acesso de cada professor ao diário: o painel gera uma senha provisória que você entrega a ele; no
          primeiro login ele cria a própria senha. {comAcesso} de {professores.length} com acesso.
        </p>
      </div>
      <Avisos salvo={typeof sp.salvo === "string" ? sp.salvo : null} erro={typeof sp.erro === "string" ? sp.erro : null} />

      <details className="mb-6 rounded-xl border border-borda bg-white p-4">
        <summary className="cursor-pointer font-bold text-verde-escuro">+ Novo professor</summary>
        <form action={criarProfessor} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="rotulo">Nome completo</span>
            <input name="nome" required maxLength={120} className="campo" />
          </label>
          <label className="block">
            <span className="rotulo">E-mail (login do diário)</span>
            <input name="email" type="email" className="campo" />
          </label>
          <button className="botao-primario">Cadastrar</button>
        </form>
      </details>

      {error && <p className="text-sm text-vinho">Não foi possível carregar os professores.</p>}
      {!error && professores.length === 0 && (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          Nenhum professor ainda. Eles aparecem depois da primeira sincronização com a Mhund.
        </p>
      )}

      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
        {professores.map((p) => {
          const turmas = [...new Set(p.turma_disciplinas.map((v) => v.turmas?.nome).filter(Boolean))];
          const disciplinas = [...new Set(p.turma_disciplinas.map((v) => v.disciplinas?.nome).filter(Boolean))];
          return (
            <li key={p.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start ${p.ativo ? "" : "opacity-55"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-titulo text-lg text-verde-escuro">
                  <Link href={`/professores/${p.id}`} className="hover:underline">
                    {p.nome}
                  </Link>
                  {p.user_id && (
                    <span className="ml-2 rounded-full bg-verde-claro/15 px-2 py-0.5 align-middle font-sans text-[11px] font-bold text-verde-claro">
                      COM ACESSO
                    </span>
                  )}
                </p>
                <p className="text-sm text-texto-suave">
                  {p.email ?? "sem e-mail"}
                  {!p.mhund_id && " · cadastrado no painel"}
                </p>
                {disciplinas.length > 0 && <p className="mt-1 text-xs text-texto">{disciplinas.join(" · ")}</p>}
                {turmas.length > 0 && (
                  <p className="text-xs text-texto-suave">
                    {turmas.length} turma{turmas.length > 1 ? "s" : ""}: {turmas.slice(0, 4).join("; ")}
                    {turmas.length > 4 ? "…" : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <Link href={`/professores/${p.id}`} className="text-sm font-bold text-verde-claro underline-offset-4 hover:underline">
                  Editar e atribuir ›
                </Link>
                {p.ativo && <BotaoAcesso professorId={p.id} temAcesso={Boolean(p.user_id)} email={p.email} />}
                <form action={alternarAtivo}>
                  <input type="hidden" name="professor_id" value={p.id} />
                  <input type="hidden" name="ativo" value={String(!p.ativo)} />
                  <button className="text-xs text-texto-suave underline-offset-4 hover:underline">
                    {p.ativo ? "Inativar" : "Reativar"}
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
