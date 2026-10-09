import Link from "next/link";
import { Avisos } from "@/components/Avisos";
import { exigirAdmin } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/datas";
import { SEGMENTOS, TURNOS } from "@/lib/segmentos";
import { criarTurma } from "./actions";
import { CamposTurma } from "./CamposTurma";

type Turma = {
  id: number;
  nome: string;
  ano: number;
  segmento: string;
  turno: string | null;
  ativa: boolean;
  mhund_id: number | null;
  matriculas: { count: number }[];
  turma_disciplinas: { professor_id: number | null }[];
};

export default async function PaginaTurmas({ searchParams }: PageProps<"/turmas">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;

  const [{ data: todas }, { data: modelos }] = await Promise.all([
    supabase
      .from("turmas")
      .select("id,nome,ano,segmento,turno,ativa,mhund_id,matriculas(count),turma_disciplinas(professor_id)")
      .eq("matriculas.ativa", true)
      .order("nome")
      .overrideTypes<Turma[], { merge: false }>(),
    supabase.from("modelos_horario").select("id,nome").order("id"),
  ]);
  const anoAtual = Number(hojeEmBrasilia().slice(0, 4));
  const anos = [...new Set([...(todas ?? []).map((t) => t.ano), anoAtual, anoAtual + 1])].sort();
  const ano = Number(p.ano) || Math.max(...(todas ?? []).filter((t) => t.ativa).map((t) => t.ano), anoAtual);
  const turmas = (todas ?? []).filter((t) => t.ano === ano).sort((a, b) => Number(b.ativa) - Number(a.ativa));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-titulo text-3xl text-verde-escuro">Turmas {ano}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Vêm da Mhund e também podem ser criadas aqui (ex.: montar {anoAtual + 1} antes da rematrícula). Turma criada
            aqui é ligada sozinha à da Mhund quando ela aparecer lá com o mesmo nome e ano. O que você edita no painel a
            sincronização não desfaz.
          </p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Ano">
          {anos.map((a) => (
            <Link key={a} href={`/turmas?ano=${a}`} className={a === ano ? "botao-primario !px-3" : "botao-secundario !px-3"}>
              {a}
            </Link>
          ))}
        </nav>
      </div>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <details className="my-6 rounded-xl border border-borda bg-white p-4">
        <summary className="cursor-pointer font-bold text-verde-escuro">+ Nova turma</summary>
        <form action={criarTurma} className="mt-4 space-y-4">
          <CamposTurma ano={ano} modelos={modelos ?? []} />
          <button className="botao-primario">Cadastrar turma</button>
        </form>
      </details>

      {turmas.length === 0 ? (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          Nenhuma turma em {ano}. Crie aqui ou aguarde a sincronização com a Mhund.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(SEGMENTOS).map(([seg, rotulo]) => {
            const doSeg = turmas.filter((t) => t.segmento === seg);
            if (doSeg.length === 0) return null;
            return (
              <section key={seg}>
                <h2 className="rotulo">{rotulo}</h2>
                <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
                  {doSeg.map((t) => {
                    const alunos = t.matriculas[0]?.count ?? 0;
                    const semProf = t.turma_disciplinas.filter((v) => !v.professor_id).length;
                    return (
                      <li key={t.id}>
                        <Link href={`/turmas/${t.id}`} className={`flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-creme ${t.ativa ? "" : "opacity-55"}`}>
                          <span className="min-w-0 flex-1 text-sm font-bold text-verde-escuro">{t.nome}</span>
                          <span className="text-xs text-texto-suave">{t.turno ? TURNOS[t.turno] : "sem turno"}</span>
                          <span className="text-xs text-texto-suave">{alunos} aluno{alunos === 1 ? "" : "s"}</span>
                          <span className="text-xs text-texto-suave">
                            {t.turma_disciplinas.length} disciplina{t.turma_disciplinas.length === 1 ? "" : "s"}
                            {semProf > 0 && <strong className="text-vinho"> · {semProf} sem professor</strong>}
                          </span>
                          <span className="text-xs text-texto-suave">{t.mhund_id ? "Mhund" : "painel"}</span>
                          {!t.ativa && <span className="text-xs font-bold text-texto-suave">INATIVA</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
