import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirProfessor } from "@/lib/auth";
import { formatarDataCurta } from "@/lib/datas";
import { lerTudo } from "@/lib/ler-tudo";

type Vinculo = {
  turma_id: number;
  disciplina_id: number;
  turmas: { nome: string; ano: number; ativa: boolean; matriculas: { count: number }[] } | null;
  disciplinas: { nome: string } | null;
};

export default async function MinhasTurmas() {
  const { supabase, professor } = await exigirProfessor();
  const letivo = await anoEmUso(supabase);

  const { data } = await supabase
    .from("turma_disciplinas")
    .select("turma_id,disciplina_id,turmas(nome,ano,ativa,matriculas(count)),disciplinas(nome)")
    .eq("professor_id", professor.id)
    .eq("turmas.matriculas.ativa", true)
    .overrideTypes<Vinculo[], { merge: false }>();
  const vinculos = (data ?? [])
    .filter((v) => v.turmas?.ativa && v.turmas.ano === letivo.ano)
    .sort(
      (a, b) =>
        (a.turmas?.nome ?? "").localeCompare(b.turmas?.nome ?? "", "pt-BR", { numeric: true }) ||
        (a.disciplinas?.nome ?? "").localeCompare(b.disciplinas?.nome ?? ""),
    );
  const turmaIds = [...new Set(vinculos.map((v) => v.turma_id))];

  // Aulas lançadas por turma/disciplina (contagem e a última data).
  const aulas = turmaIds.length
    ? await lerTudo<{ turma_id: number; disciplina_id: number; data: string }>((de, ate) =>
        supabase
          .from("aulas")
          .select("turma_id,disciplina_id,data")
          .in("turma_id", turmaIds)
          .gte("data", `${letivo.ano}-01-01`)
          .lte("data", `${letivo.ano}-12-31`)
          .order("data", { ascending: false })
          .order("id")
          .range(de, ate),
      )
    : [];
  const resumo = (t: number, d: number) => {
    const daqui = aulas.filter((a) => a.turma_id === t && a.disciplina_id === d);
    return { total: daqui.length, ultima: daqui[0]?.data ?? null };
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-dourado">{letivo.ano}</p>
        <h1 className="font-titulo text-2xl text-verde-escuro">Minhas turmas</h1>
      </div>
      {vinculos.length === 0 && (
        <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">
          Nenhuma turma de {letivo.ano} atribuída a você ainda. Fale com a secretaria.
        </p>
      )}
      <ul className="space-y-2">
        {vinculos.map((v) => {
          const r = resumo(v.turma_id, v.disciplina_id);
          const alunos = v.turmas?.matriculas[0]?.count ?? 0;
          return (
            <li key={`${v.turma_id}-${v.disciplina_id}`}>
              <Link
                href={`/professor/turma?turma=${v.turma_id}&disciplina=${v.disciplina_id}`}
                className="flex items-center gap-3 rounded-xl border border-borda bg-white p-4 active:bg-creme"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-titulo text-lg leading-tight text-verde-escuro">{v.disciplinas?.nome}</span>
                  <span className="block truncate text-sm text-texto-suave">{v.turmas?.nome}</span>
                  <span className="mt-1 block text-xs text-texto-suave">
                    {alunos} aluno{alunos === 1 ? "" : "s"} · {r.total} aula{r.total === 1 ? "" : "s"} lançada{r.total === 1 ? "" : "s"}
                    {r.ultima ? ` · última ${formatarDataCurta(r.ultima)}` : ""}
                  </span>
                </span>
                <span className="text-xs font-bold text-verde-claro">ABRIR ›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
