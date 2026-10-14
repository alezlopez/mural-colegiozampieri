import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaAnual, resultadoBimestre, type RegraAvaliacao, type ResultadoBimestre } from "./avaliacao";
import { bimestresDoAno, regraDoSegmento, type Bimestre } from "./avaliacao-db";
import { lerTudo } from "./ler-tudo";

export type LinhaBoletim = {
  disciplina_id: number;
  disciplina: string;
  bimestres: { resultado: ResultadoBimestre; faltas: number; parecer: string | null }[];
  anual: { media: number | null; parcial: number | null };
  faltasNoAno: number;
};
export type BoletimAluno = { codigo: string; nome: string; numero: number | null; linhas: LinhaBoletim[] };
export type BoletimTurma = {
  turma: { id: number; nome: string; ano: number; segmento: string };
  regra: RegraAvaliacao;
  bimestres: Bimestre[];
  alunos: BoletimAluno[];
};

/** Boletins da turma (todos os alunos ativos, ou só os informados). */
export async function boletimDaTurma(db: SupabaseClient, turmaId: number, somente?: string[]): Promise<BoletimTurma | null> {
  const { data: turma } = await db.from("turmas").select("id,nome,ano,segmento").eq("id", turmaId).maybeSingle();
  if (!turma) return null;
  const ano = turma.ano as number;

  const [regra, { bimestres }, { data: vinculos }, { data: matriculas }] = await Promise.all([
    regraDoSegmento(db, ano, turma.segmento as string),
    bimestresDoAno(db, ano),
    db.from("turma_disciplinas").select("disciplina_id,disciplinas(nome)").eq("turma_id", turmaId),
    db.from("matriculas").select("aluno_codigo,numero_chamada,alunos(nome)").eq("turma_id", turmaId).eq("ativa", true),
  ]);
  type Mat = { aluno_codigo: string; numero_chamada: number | null; alunos: { nome: string } | null };
  const alunos = ((matriculas ?? []) as unknown as Mat[])
    .filter((m) => !somente || somente.includes(m.aluno_codigo))
    .sort((a, b) => (a.numero_chamada ?? 999) - (b.numero_chamada ?? 999) || (a.alunos?.nome ?? "").localeCompare(b.alunos?.nome ?? "", "pt-BR"));
  const codigos = alunos.map((a) => a.aluno_codigo);
  const disciplinas = ((vinculos ?? []) as unknown as { disciplina_id: number; disciplinas: { nome: string } | null }[])
    .map((v) => ({ id: v.disciplina_id, nome: v.disciplinas?.nome ?? "?" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const [notas, pareceres, faltas] = codigos.length
    ? await Promise.all([
        lerTudo<{ aluno_codigo: string; disciplina_id: number; bimestre: number; avaliacao: string; valor: number }>((de, ate) =>
          db
            .from("notas")
            .select("aluno_codigo,disciplina_id,bimestre,avaliacao,valor")
            .eq("ano", ano)
            .in("aluno_codigo", codigos)
            .order("aluno_codigo")
            .order("disciplina_id")
            .order("bimestre")
            .order("avaliacao")
            .range(de, ate),
        ),
        lerTudo<{ aluno_codigo: string; disciplina_id: number; bimestre: number; texto: string }>((de, ate) =>
          db
            .from("pareceres")
            .select("aluno_codigo,disciplina_id,bimestre,texto")
            .eq("ano", ano)
            .in("aluno_codigo", codigos)
            .order("aluno_codigo")
            .order("disciplina_id")
            .order("bimestre")
            .range(de, ate),
        ),
        // Só as ausências (falta e falta justificada) da turma no ano: bem menos linhas que todas as chamadas.
        lerTudo<{ aluno_codigo: string; aulas: { disciplina_id: number; data: string } }>((de, ate) =>
          db
            .from("frequencias")
            .select("aluno_codigo,aulas!inner(turma_id,disciplina_id,data)")
            .in("aluno_codigo", codigos)
            .in("status", ["falta", "falta_justificada"])
            .eq("aulas.turma_id", turmaId)
            .gte("aulas.data", `${ano}-01-01`)
            .lte("aulas.data", `${ano}-12-31`)
            .order("aula_id")
            .order("aluno_codigo")
            .range(de, ate)
            .overrideTypes<{ aluno_codigo: string; aulas: { disciplina_id: number; data: string } }[], { merge: false }>(),
        ),
      ])
    : [[], [], []];

  const bimestreDaData = (data: string) => bimestres.find((b) => b.inicio <= data && data <= b.fim)?.numero ?? null;

  return {
    turma: { id: turma.id as number, nome: turma.nome as string, ano, segmento: turma.segmento as string },
    regra,
    bimestres,
    alunos: alunos.map((a) => ({
      codigo: a.aluno_codigo,
      nome: a.alunos?.nome ?? `Aluno ${a.aluno_codigo}`,
      numero: a.numero_chamada,
      linhas: disciplinas.map((d) => {
        const porBimestre = [1, 2, 3, 4].map((b) => {
          const daqui = Object.fromEntries(
            notas.filter((n) => n.aluno_codigo === a.aluno_codigo && n.disciplina_id === d.id && n.bimestre === b).map((n) => [n.avaliacao, Number(n.valor)]),
          );
          return {
            resultado: resultadoBimestre(daqui, regra),
            faltas: faltas.filter((f) => f.aluno_codigo === a.aluno_codigo && f.aulas.disciplina_id === d.id && bimestreDaData(f.aulas.data) === b).length,
            parecer: pareceres.find((p) => p.aluno_codigo === a.aluno_codigo && p.disciplina_id === d.id && p.bimestre === b)?.texto ?? null,
          };
        });
        return {
          disciplina_id: d.id,
          disciplina: d.nome,
          bimestres: porBimestre,
          anual: mediaAnual(porBimestre.map((x) => x.resultado.final), regra),
          faltasNoAno: faltas.filter((f) => f.aluno_codigo === a.aluno_codigo && f.aulas.disciplina_id === d.id).length,
        };
      }),
    })),
  };
}
