import { mediaAnual, resultadoBimestre, type RegraAvaliacao, type ResultadoBimestre } from './avaliacao';
import { supabase } from './supabase';

// Dados da vida escolar para a família (diário, frequência, calendário). As regras de acesso (RLS) garantem que o
// responsável só lê as aulas e o calendário da turma do filho e a frequência do próprio filho.

export type TurmaDoAluno = { turma_id: number; nome: string; ano: number; segmento: string };
export type StatusChamada = 'presente' | 'falta' | 'falta_justificada';

/** Turma em que o aluno está matriculado no ano mais recente (a do ano letivo em uso). */
export async function turmaAtual(codigo: string): Promise<TurmaDoAluno | null> {
  const { data, error } = await supabase
    .from('matriculas')
    .select('turma_id,ano,turmas(nome,segmento)')
    .eq('aluno_codigo', codigo)
    .eq('ativa', true)
    .order('ano', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Não foi possível carregar a turma.');
  if (!data) return null;
  const turma = data.turmas as unknown as { nome: string; segmento: string } | null;
  return { turma_id: data.turma_id, ano: data.ano, nome: turma?.nome ?? '', segmento: turma?.segmento ?? '' };
}

export type AulaDoDia = {
  id: string;
  aula_numero: number;
  disciplina: string;
  conteudo: string;
  tarefa: string | null;
  tarefa_entrega: string | null;
  presenca: StatusChamada | null;
};

export async function aulasDoDia(turmaId: number, codigo: string, data: string): Promise<AulaDoDia[]> {
  const { data: linhas, error } = await supabase
    .from('aulas')
    .select('id,aula_numero,conteudo,tarefa,tarefa_entrega,disciplinas(nome),frequencias(aluno_codigo,status)')
    .eq('turma_id', turmaId)
    .eq('data', data)
    .not('conteudo', 'is', null)
    .eq('frequencias.aluno_codigo', codigo)
    .order('aula_numero');
  if (error) throw new Error('Não foi possível carregar as aulas do dia.');
  return linhas.map((a) => ({
    id: a.id,
    aula_numero: a.aula_numero,
    disciplina: (a.disciplinas as unknown as { nome: string } | null)?.nome ?? '',
    conteudo: a.conteudo ?? '',
    tarefa: a.tarefa,
    tarefa_entrega: a.tarefa_entrega,
    presenca: ((a.frequencias as { status: StatusChamada }[] | null) ?? [])[0]?.status ?? null,
  }));
}

export type Tarefa = { id: string; disciplina: string; tarefa: string; entrega: string; dada_em: string };

/** Tarefas com entrega de hoje em diante. */
export async function tarefasParaEntregar(turmaId: number, hoje: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('aulas')
    .select('id,data,tarefa,tarefa_entrega,disciplinas(nome)')
    .eq('turma_id', turmaId)
    .not('tarefa', 'is', null)
    .gte('tarefa_entrega', hoje)
    .order('tarefa_entrega')
    .limit(30);
  if (error) throw new Error('Não foi possível carregar as tarefas.');
  // Aula dupla grava a mesma tarefa duas vezes: mostra uma só.
  const vistas = new Set<string>();
  return data
    .map((a) => ({
      id: a.id,
      disciplina: (a.disciplinas as unknown as { nome: string } | null)?.nome ?? '',
      tarefa: a.tarefa ?? '',
      entrega: a.tarefa_entrega ?? '',
      dada_em: a.data,
    }))
    .filter((t) => {
      const chave = `${t.disciplina}|${t.tarefa}|${t.entrega}`;
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
}

export type EventoEscolar = { id: number; inicio: string; fim: string; tipo: string; titulo: string; descricao: string | null; letivo: boolean };

export const ROTULO_EVENTO: Record<string, string> = {
  feriado: 'Feriado',
  recesso: 'Recesso',
  sabado_letivo: 'Sábado letivo',
  avaliacao: 'Avaliação',
  evento: 'Evento',
  reuniao: 'Reunião',
  conselho: 'Conselho de classe',
  outro: 'Aviso',
};

/** Eventos públicos da escola toda e da turma, que tocam o período [de, ate]. */
export async function eventosDaTurma(turmaId: number, de: string, ate: string): Promise<EventoEscolar[]> {
  const { data, error } = await supabase
    .from('calendario_eventos')
    .select('id,inicio,fim,tipo,titulo,descricao,letivo,turmas,publico')
    .eq('publico', true)
    .lte('inicio', ate)
    .gte('fim', de)
    .order('inicio');
  if (error) throw new Error('Não foi possível carregar o calendário.');
  return data
    .filter((e) => !e.turmas || e.turmas.length === 0 || (e.turmas as number[]).includes(turmaId))
    .map(({ turmas: _t, publico: _p, ...e }) => e);
}

export type FrequenciaDisciplina = { disciplina: string; aulas: number; faltas: number; justificadas: number; percentual: number };
export const FREQUENCIA_MINIMA = 75;

/** Frequência do aluno no ano, por disciplina (falta justificada conta como ausência). */
export async function frequenciaDoAluno(codigo: string, turmaId: number, ano: number) {
  type Linha = { status: StatusChamada; aulas: { disciplinas: { nome: string } | null } | null };
  const linhas: Linha[] = [];
  // O Supabase devolve no máximo 1.000 linhas por vez; um ano tem mais aulas que isso.
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from('frequencias')
      .select('status,aulas!inner(turma_id,data,disciplinas(nome))')
      .eq('aluno_codigo', codigo)
      .eq('aulas.turma_id', turmaId)
      .gte('aulas.data', `${ano}-01-01`)
      .lte('aulas.data', `${ano}-12-31`)
      .order('aula_id')
      .range(de, de + 999);
    if (error) throw new Error('Não foi possível carregar a frequência.');
    linhas.push(...(data as unknown as Linha[]));
    if (data.length < 1000) break;
  }
  const porDisciplina = new Map<string, { aulas: number; faltas: number; justificadas: number }>();
  for (const l of linhas) {
    const nome = l.aulas?.disciplinas?.nome ?? '—';
    const r = porDisciplina.get(nome) ?? { aulas: 0, faltas: 0, justificadas: 0 };
    r.aulas++;
    if (l.status === 'falta') r.faltas++;
    if (l.status === 'falta_justificada') r.justificadas++;
    porDisciplina.set(nome, r);
  }
  const pct = (r: { aulas: number; faltas: number; justificadas: number }) =>
    r.aulas ? Math.round(((r.aulas - r.faltas - r.justificadas) / r.aulas) * 100) : 100;
  const disciplinas: FrequenciaDisciplina[] = [...porDisciplina.entries()]
    .map(([disciplina, r]) => ({ disciplina, ...r, percentual: pct(r) }))
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina));
  const total = disciplinas.reduce((s, d) => ({ aulas: s.aulas + d.aulas, faltas: s.faltas + d.faltas, justificadas: s.justificadas + d.justificadas }), {
    aulas: 0,
    faltas: 0,
    justificadas: 0,
  });
  return { disciplinas, total: { ...total, percentual: pct(total) } };
}

// ---------------------------------------------------------------------------
// Boletim: a família só recebe as notas dos bimestres que a escola publicou (regra no banco).
// ---------------------------------------------------------------------------

export type DisciplinaNoBoletim = {
  disciplina: string;
  bimestres: { numero: number; publicado: boolean; resultado: ResultadoBimestre; parecer: string | null }[];
  anual: { media: number | null; parcial: number | null };
};

export async function boletimDoAluno(codigo: string, turma: TurmaDoAluno) {
  const [{ data: config }, { data: bimestres }, { data: vinculos }, { data: notas }, { data: pareceres }] = await Promise.all([
    supabase
      .from('avaliacao_config')
      .select('avaliacoes,media_aprovacao,arredondamento,recuperacao_bimestral,descritivo')
      .eq('ano', turma.ano)
      .eq('segmento', turma.segmento)
      .maybeSingle(),
    supabase.from('bimestres').select('numero,boletim_publicado').eq('ano', turma.ano).order('numero'),
    supabase.from('turma_disciplinas').select('disciplina_id,disciplinas(nome)').eq('turma_id', turma.turma_id),
    supabase.from('notas').select('disciplina_id,bimestre,avaliacao,valor').eq('aluno_codigo', codigo).eq('ano', turma.ano),
    supabase.from('pareceres').select('disciplina_id,bimestre,texto').eq('aluno_codigo', codigo).eq('ano', turma.ano),
  ]);
  if (!config) return { regra: null, disciplinas: [], publicados: [] as number[] };
  const regra: RegraAvaliacao = { ...(config as RegraAvaliacao), media_aprovacao: Number(config.media_aprovacao) };
  const publicados = (bimestres ?? []).filter((b) => b.boletim_publicado).map((b) => b.numero as number);

  const disciplinas: DisciplinaNoBoletim[] = ((vinculos ?? []) as unknown as { disciplina_id: number; disciplinas: { nome: string } | null }[])
    .map((v) => {
      const porBimestre = [1, 2, 3, 4].map((b) => {
        const daqui = Object.fromEntries(
          (notas ?? []).filter((n) => n.disciplina_id === v.disciplina_id && n.bimestre === b).map((n) => [n.avaliacao, Number(n.valor)]),
        );
        return {
          numero: b,
          publicado: publicados.includes(b),
          resultado: resultadoBimestre(daqui, regra),
          parecer: (pareceres ?? []).find((p) => p.disciplina_id === v.disciplina_id && p.bimestre === b)?.texto ?? null,
        };
      });
      return { disciplina: v.disciplinas?.nome ?? '', bimestres: porBimestre, anual: mediaAnual(porBimestre.map((x) => x.resultado.final), regra) };
    })
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina));
  return { regra, disciplinas, publicados };
}
