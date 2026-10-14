import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anoEmUso } from "./ano-letivo";
import { aulasPrevistas } from "./aulas-previstas";
import { baseDoAno, maiorData, menorData } from "./aulas-previstas-db";
import { resultadoBimestre, type RegraAvaliacao } from "./avaliacao";
import { bimestresDoAno, regraDoSegmento } from "./avaliacao-db";
import { hojeEmBrasilia, somarDias } from "./datas";
import { lerTudo } from "./ler-tudo";

// Acompanhamento da coordenação: alunos em risco (faltas e notas) e o que cada professor tem lançado.
// Os totais pesados vêm de funções do banco (acomp_*); aqui só se cruza com turmas, regras e horário.

/** Frequência mínima exigida pela LDB (art. 24, VI): 75% do total de horas letivas. */
export const FREQUENCIA_MINIMA = 75;

export type LinhaFrequencia = { aluno_codigo: string; turma_id: number; disciplina_id: number; aulas: number; faltas: number; justificadas: number };

/** Chamadas registradas no ano por aluno/turma/disciplina (falta e falta justificada contam como ausência, como no boletim). */
export function frequenciaDoAno(db: SupabaseClient, ano: number, aluno?: string) {
  return lerTudo<LinhaFrequencia>((de, ate) =>
    db
      .rpc("acomp_frequencia", { p_ano: ano, p_aluno: aluno ?? null })
      .order("aluno_codigo")
      .order("turma_id")
      .order("disciplina_id")
      .range(de, ate),
  );
}

/** % de presença: (aulas − ausências) / aulas. */
export const presenca = (aulas: number, ausencias: number) => (aulas ? Math.round(((aulas - ausencias) / aulas) * 1000) / 10 : null);

type Turma = { id: number; nome: string; segmento: string };

async function contextoDoAno(db: SupabaseClient) {
  const letivo = await anoEmUso(db);
  const { data } = await db.from("turmas").select("id,nome,segmento").eq("ano", letivo.ano).eq("ativa", true).order("nome");
  const turmas = (data ?? []) as Turma[];
  const segmentos = [...new Set(turmas.map((t) => t.segmento))];
  const regras = new Map<string, RegraAvaliacao>(
    await Promise.all(segmentos.map(async (s) => [s, await regraDoSegmento(db, letivo.ano, s)] as const)),
  );
  return { letivo, turmas, regras };
}

export type AlunoEmRisco = {
  codigo: string;
  nome: string;
  turma: string | null;
  turmaId: number | null;
  /** Presença geral no ano (todas as disciplinas). */
  presencaGeral: number | null;
  faltas: { disciplina: string; aulas: number; ausencias: number; justificadas: number; presenca: number }[];
  notas: { disciplina: string; bimestre: number; nota: number; parcial: boolean; recuperacaoPendente: boolean }[];
};

/**
 * Alunos com presença abaixo do limite em alguma disciplina ou com média (ou parcial) abaixo da média de aprovação
 * em algum bimestre. Infantil (avaliação descritiva) entra só pelas faltas.
 */
export async function alunosEmRisco(db: SupabaseClient, { limitePresenca = FREQUENCIA_MINIMA } = {}) {
  const { letivo, turmas, regras } = await contextoDoAno(db);
  const ano = letivo.ano;
  const limiteNota = Math.max(6, ...[...regras.values()].map((r) => r.media_aprovacao));

  const [freq, notas, matriculas, { data: disciplinas }] = await Promise.all([
    frequenciaDoAno(db, ano),
    lerTudo<{ aluno_codigo: string; turma_id: number; disciplina_id: number; bimestre: number; notas: Record<string, number> }>((de, ate) =>
      db
        .rpc("acomp_notas_baixas", { p_ano: ano, p_limite: limiteNota })
        .order("aluno_codigo")
        .order("disciplina_id")
        .order("bimestre")
        .range(de, ate),
    ),
    lerTudo<{ aluno_codigo: string; turma_id: number; alunos: { nome: string } | null }>((de, ate) =>
      db
        .from("matriculas")
        .select("aluno_codigo,turma_id,alunos(nome)")
        .eq("ano", ano)
        .eq("ativa", true)
        .order("aluno_codigo")
        .order("turma_id")
        .range(de, ate)
        .overrideTypes<{ aluno_codigo: string; turma_id: number; alunos: { nome: string } | null }[], { merge: false }>(),
    ),
    db.from("disciplinas").select("id,nome"),
  ]);

  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));
  const nomeDisc = new Map((disciplinas ?? []).map((d) => [d.id as number, d.nome as string]));
  const matricula = new Map(matriculas.map((m) => [m.aluno_codigo, m]));
  const porAluno = new Map<string, AlunoEmRisco>();
  const aluno = (codigo: string) => {
    let a = porAluno.get(codigo);
    if (!a) {
      const m = matricula.get(codigo);
      const t = m ? turmaPorId.get(m.turma_id) : undefined;
      a = { codigo, nome: m?.alunos?.nome ?? `Aluno ${codigo}`, turma: t?.nome ?? null, turmaId: t?.id ?? null, presencaGeral: null, faltas: [], notas: [] };
      porAluno.set(codigo, a);
    }
    return a;
  };

  // Faltas: soma por disciplina (aluno que trocou de turma tem as duas partes somadas).
  const somaDisc = new Map<string, { aulas: number; ausencias: number; justificadas: number }>();
  const somaGeral = new Map<string, { aulas: number; ausencias: number }>();
  for (const f of freq) {
    if (!matricula.has(f.aluno_codigo)) continue; // só quem está matriculado no ano
    const k = `${f.aluno_codigo}:${f.disciplina_id}`;
    const d = somaDisc.get(k) ?? { aulas: 0, ausencias: 0, justificadas: 0 };
    d.aulas += f.aulas;
    d.ausencias += f.faltas + f.justificadas;
    d.justificadas += f.justificadas;
    somaDisc.set(k, d);
    const g = somaGeral.get(f.aluno_codigo) ?? { aulas: 0, ausencias: 0 };
    g.aulas += f.aulas;
    g.ausencias += f.faltas + f.justificadas;
    somaGeral.set(f.aluno_codigo, g);
  }
  for (const [k, d] of somaDisc) {
    const p = presenca(d.aulas, d.ausencias);
    if (p === null || p >= limitePresenca) continue;
    const [codigo, disc] = k.split(":");
    aluno(codigo).faltas.push({ disciplina: nomeDisc.get(Number(disc)) ?? "?", aulas: d.aulas, ausencias: d.ausencias, justificadas: d.justificadas, presenca: p });
  }

  // Notas: média do bimestre (ou parcial, se faltam avaliações) abaixo da média de aprovação do segmento.
  for (const n of notas) {
    if (!matricula.has(n.aluno_codigo)) continue;
    const segmento = turmaPorId.get(n.turma_id)?.segmento ?? turmaPorId.get(matricula.get(n.aluno_codigo)!.turma_id)?.segmento;
    const regra = segmento ? regras.get(segmento) : undefined;
    if (!regra || regra.descritivo) continue;
    const r = resultadoBimestre(n.notas, regra);
    const nota = r.final ?? r.parcial;
    if (nota === null || nota >= regra.media_aprovacao) continue;
    aluno(n.aluno_codigo).notas.push({
      disciplina: nomeDisc.get(n.disciplina_id) ?? "?",
      bimestre: n.bimestre,
      nota,
      parcial: r.final === null,
      recuperacaoPendente: r.emRecuperacao && r.recuperacao === null,
    });
  }

  for (const a of porAluno.values()) {
    const g = somaGeral.get(a.codigo);
    a.presencaGeral = g ? presenca(g.aulas, g.ausencias) : null;
    a.faltas.sort((x, y) => x.presenca - y.presenca);
    a.notas.sort((x, y) => x.bimestre - y.bimestre || x.nota - y.nota);
  }
  const lista = [...porAluno.values()].sort(
    (x, y) => y.faltas.length + y.notas.length - (x.faltas.length + x.notas.length) || (x.turma ?? "").localeCompare(y.turma ?? "") || x.nome.localeCompare(y.nome),
  );
  return { ano, limitePresenca, turmas, alunos: lista, comChamada: somaGeral.size };
}

export type LinhaProfessor = {
  turmaId: number;
  turma: string;
  disciplina: string;
  previstas: number | null;
  lancadas: number;
  semChamada: number;
  ultimoLancamento: string | null;
  /** null = avaliação descritiva (infantil) ou turma sem alunos. */
  notas: { lancadas: number; esperadas: number } | null;
  planejamento: { ultimoInicio: string | null; aguardandoVisto: number };
};
export type ResumoProfessor = { chave: string; nome: string; temAcesso: boolean; linhas: LinhaProfessor[] };

/**
 * Por professor e turma/disciplina, no bimestre atual até ontem: aulas previstas pelo horário × lançadas, aulas
 * lançadas sem chamada, notas lançadas do bimestre × esperadas (alunos × avaliações) e planejamentos.
 */
export async function resumoProfessores(db: SupabaseClient) {
  const { letivo, turmas, regras } = await contextoDoAno(db);
  const ano = letivo.ano;
  const turmaIds = turmas.map((t) => t.id);
  const [base, { bimestres, atual }] = await Promise.all([baseDoAno(db, ano, turmaIds), bimestresDoAno(db, ano)]);
  const bim = bimestres.find((b) => b.numero === atual);

  const ontem = somarDias(hojeEmBrasilia(), -1);
  const de = maiorData(bim?.inicio ?? base?.inicio ?? `${ano}-01-01`, base?.inicio ?? `${ano}-01-01`);
  const ate = menorData(menorData(ontem, bim?.fim ?? `${ano}-12-31`), base?.fim ?? `${ano}-12-31`);

  type Vinculo = {
    turma_id: number;
    disciplina_id: number;
    professor_id: number | null;
    disciplinas: { nome: string } | null;
    professores: { nome: string; user_id: string | null } | null;
  };
  const [{ data: vinculos }, porTD, matriculas, planejamentos] = await Promise.all([
    turmaIds.length
      ? db
          .from("turma_disciplinas")
          .select("turma_id,disciplina_id,professor_id,disciplinas(nome),professores(nome,user_id)")
          .in("turma_id", turmaIds)
          .overrideTypes<Vinculo[], { merge: false }>()
      : Promise.resolve({ data: [] as Vinculo[] }),
    lerTudo<{ turma_id: number; disciplina_id: number; aulas_lancadas: number; aulas_sem_chamada: number; ultimo_lancamento: string | null; notas_lancadas: number }>(
      (i, f) =>
        db
          .rpc("acomp_turma_disciplina", { p_ano: ano, p_de: de, p_ate: ate < de ? de : ate, p_bimestre: atual })
          .order("turma_id")
          .order("disciplina_id")
          .range(i, f),
    ),
    lerTudo<{ turma_id: number }>((i, f) => db.from("matriculas").select("turma_id").eq("ano", ano).eq("ativa", true).order("aluno_codigo").order("turma_id").range(i, f)),
    turmaIds.length
      ? lerTudo<{ turma_id: number; disciplina_id: number; inicio: string; visto_em: string | null }>((i, f) =>
          db.from("planejamentos").select("turma_id,disciplina_id,inicio,visto_em").in("turma_id", turmaIds).order("id").range(i, f),
        )
      : Promise.resolve([]),
  ]);

  const previstas = new Map<string, number>();
  if (base && de <= ate) {
    for (const a of aulasPrevistas({ turmas: turmaIds, slots: base.slots, eventos: base.eventos, de, ate })) {
      const k = `${a.turma_id}:${a.disciplina_id}`;
      previstas.set(k, (previstas.get(k) ?? 0) + 1);
    }
  }
  const td = new Map(porTD.map((x) => [`${x.turma_id}:${x.disciplina_id}`, x]));
  const alunosPorTurma = new Map<number, number>();
  for (const m of matriculas) alunosPorTurma.set(m.turma_id, (alunosPorTurma.get(m.turma_id) ?? 0) + 1);
  const turmaPorId = new Map(turmas.map((t) => [t.id, t]));

  const grupos = new Map<string, ResumoProfessor>();
  for (const v of vinculos ?? []) {
    const t = turmaPorId.get(v.turma_id);
    if (!t) continue;
    const chave = v.professor_id ? String(v.professor_id) : "sem";
    const g = grupos.get(chave) ?? { chave, nome: v.professores?.nome ?? "Sem professor atribuído", temAcesso: Boolean(v.professores?.user_id), linhas: [] };
    const k = `${v.turma_id}:${v.disciplina_id}`;
    const r = td.get(k);
    const regra = regras.get(t.segmento);
    const alunos = alunosPorTurma.get(v.turma_id) ?? 0;
    const planos = planejamentos.filter((p) => p.turma_id === v.turma_id && p.disciplina_id === v.disciplina_id);
    g.linhas.push({
      turmaId: v.turma_id,
      turma: t.nome,
      disciplina: v.disciplinas?.nome ?? "?",
      previstas: base ? (previstas.get(k) ?? 0) : null,
      lancadas: r?.aulas_lancadas ?? 0,
      semChamada: r?.aulas_sem_chamada ?? 0,
      ultimoLancamento: r?.ultimo_lancamento ?? null,
      notas: regra && !regra.descritivo && alunos ? { lancadas: r?.notas_lancadas ?? 0, esperadas: alunos * regra.avaliacoes.length } : null,
      planejamento: {
        ultimoInicio: planos.reduce<string | null>((m, p) => (!m || p.inicio > m ? p.inicio : m), null),
        aguardandoVisto: planos.filter((p) => !p.visto_em).length,
      },
    });
    grupos.set(chave, g);
  }

  const professores = [...grupos.values()].map((g) => {
    g.linhas.sort((a, b) => a.turma.localeCompare(b.turma, "pt-BR") || a.disciplina.localeCompare(b.disciplina, "pt-BR"));
    return { ...g, ...totaisProfessor(g.linhas) };
  });
  professores.sort((a, b) => b.pendentes - a.pendentes || a.nome.localeCompare(b.nome, "pt-BR"));
  return { ano, bimestre: atual, temBimestres: bimestres.length > 0, temAnoLetivo: Boolean(base), de, ate, professores };
}

export function totaisProfessor(linhas: LinhaProfessor[]) {
  const previstas = linhas.reduce((s, l) => s + (l.previstas ?? 0), 0);
  const lancadas = linhas.reduce((s, l) => s + Math.min(l.lancadas, l.previstas ?? l.lancadas), 0);
  const notasEsperadas = linhas.reduce((s, l) => s + (l.notas?.esperadas ?? 0), 0);
  const notasLancadas = linhas.reduce((s, l) => s + Math.min(l.notas?.lancadas ?? 0, l.notas?.esperadas ?? 0), 0);
  const ultimo = linhas.reduce<string | null>((m, l) => (l.ultimoLancamento && (!m || l.ultimoLancamento > m) ? l.ultimoLancamento : m), null);
  return {
    previstas,
    lancadas,
    pendentes: Math.max(0, previstas - lancadas),
    semChamada: linhas.reduce((s, l) => s + l.semChamada, 0),
    notasEsperadas,
    notasLancadas,
    aguardandoVisto: linhas.reduce((s, l) => s + l.planejamento.aguardandoVisto, 0),
    ultimoLancamento: ultimo,
  };
}

/** "87%" (ou "—" sem base). */
export const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)}%` : "—");
