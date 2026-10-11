import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "./ler-tudo";

// Rematrícula: compara quem cursava no ano base (matrícula ativa) com as matrículas do ano seguinte.
// Situação "L" na Mhund = cursando. Quem estava numa turma de conclusão (ultima_serie) e não voltou se formou.

const CURSANDO = "L";

export type TurmaResumo = { id: number; nome: string; ano: number; segmento: string; ultima_serie: boolean };
export type AlunoRematricula = {
  codigo: string;
  nome: string;
  turmaBase: string | null;
  turmaAlvo: string | null;
  /** Situação da matrícula no ano seguinte, quando existe e não é "cursando" (ex.: C = cancelada). */
  situacaoAlvo: string | null;
  responsavel: string | null;
  telefone: string | null;
};

export type RelatorioRematricula = {
  base: number;
  alvo: number;
  cursandoBase: number;
  matriculadosAlvo: number;
  rematriculados: AlunoRematricula[];
  novos: AlunoRematricula[];
  concluintes: AlunoRematricula[];
  naoRematriculados: AlunoRematricula[];
  porTurmaBase: { turma: string; ultimaSerie: boolean; total: number; voltaram: number; naoVoltaram: number }[];
  porTurmaAlvo: { turma: string; total: number; veteranos: number; novos: number }[];
};

type Matricula = { aluno_codigo: string; turma_id: number; ano: number; situacao: string | null; ativa: boolean };

export async function relatorioRematricula(db: SupabaseClient, base: number, alvo: number): Promise<RelatorioRematricula> {
  const [turmas, matriculas, alunos, responsaveis] = await Promise.all([
    lerTudo<TurmaResumo>((de, ate) => db.from("turmas").select("id,nome,ano,segmento,ultima_serie").in("ano", [base, alvo]).order("id").range(de, ate)),
    lerTudo<Matricula>((de, ate) =>
      db.from("matriculas").select("aluno_codigo,turma_id,ano,situacao,ativa").in("ano", [base, alvo]).order("aluno_codigo").order("turma_id").range(de, ate),
    ),
    lerTudo<{ codigo: string; nome: string }>((de, ate) => db.from("alunos").select("codigo,nome").order("codigo").range(de, ate)),
    lerTudo<{ aluno_codigo: string; nome: string | null; telefone: string }>((de, ate) =>
      db.from("aluno_responsaveis").select("aluno_codigo,nome,telefone").order("aluno_codigo").order("telefone").range(de, ate),
    ),
  ]);

  const turma = new Map(turmas.map((t) => [t.id, t]));
  const nome = new Map(alunos.map((a) => [a.codigo, a.nome]));
  const resp = new Map<string, { nome: string | null; telefone: string }>();
  for (const r of responsaveis) if (!resp.has(r.aluno_codigo)) resp.set(r.aluno_codigo, r);

  // Ano base: matrícula ativa (cursando). Ano alvo: a matrícula "cursando" vale mais que outra situação.
  const naBase = new Map<string, Matricula>();
  const noAlvo = new Map<string, Matricula>();
  for (const m of matriculas) {
    if (m.ano === base && m.ativa) naBase.set(m.aluno_codigo, m);
    if (m.ano === alvo) {
      const atual = noAlvo.get(m.aluno_codigo);
      if (!atual || (atual.situacao !== CURSANDO && m.situacao === CURSANDO)) noAlvo.set(m.aluno_codigo, m);
    }
  }

  const linha = (codigo: string): AlunoRematricula => {
    const b = naBase.get(codigo);
    const a = noAlvo.get(codigo);
    return {
      codigo,
      nome: nome.get(codigo) ?? `Aluno ${codigo}`,
      turmaBase: b ? turma.get(b.turma_id)?.nome ?? null : null,
      turmaAlvo: a ? turma.get(a.turma_id)?.nome ?? null : null,
      situacaoAlvo: a && a.situacao !== CURSANDO ? a.situacao : null,
      responsavel: resp.get(codigo)?.nome ?? null,
      telefone: resp.get(codigo)?.telefone ?? null,
    };
  };
  const porNome = (x: AlunoRematricula, y: AlunoRematricula) =>
    (x.turmaBase ?? x.turmaAlvo ?? "").localeCompare(y.turmaBase ?? y.turmaAlvo ?? "") || x.nome.localeCompare(y.nome);

  const voltou = (codigo: string) => noAlvo.get(codigo)?.situacao === CURSANDO;
  const rematriculados: AlunoRematricula[] = [];
  const concluintes: AlunoRematricula[] = [];
  const naoRematriculados: AlunoRematricula[] = [];
  for (const [codigo, m] of naBase) {
    if (voltou(codigo)) rematriculados.push(linha(codigo));
    else if (turma.get(m.turma_id)?.ultima_serie) concluintes.push(linha(codigo));
    else naoRematriculados.push(linha(codigo));
  }
  const novos = [...noAlvo.keys()].filter((c) => voltou(c) && !naBase.has(c)).map(linha);

  const porTurmaBase = new Map<number, { turma: string; ultimaSerie: boolean; total: number; voltaram: number; naoVoltaram: number }>();
  for (const [codigo, m] of naBase) {
    const t = turma.get(m.turma_id);
    const item = porTurmaBase.get(m.turma_id) ?? { turma: t?.nome ?? "?", ultimaSerie: Boolean(t?.ultima_serie), total: 0, voltaram: 0, naoVoltaram: 0 };
    item.total++;
    if (voltou(codigo)) item.voltaram++;
    else item.naoVoltaram++;
    porTurmaBase.set(m.turma_id, item);
  }
  const porTurmaAlvo = new Map<number, { turma: string; total: number; veteranos: number; novos: number }>();
  for (const [codigo, m] of noAlvo) {
    if (m.situacao !== CURSANDO) continue;
    const item = porTurmaAlvo.get(m.turma_id) ?? { turma: turma.get(m.turma_id)?.nome ?? "?", total: 0, veteranos: 0, novos: 0 };
    item.total++;
    if (naBase.has(codigo)) item.veteranos++;
    else item.novos++;
    porTurmaAlvo.set(m.turma_id, item);
  }

  return {
    base,
    alvo,
    cursandoBase: naBase.size,
    matriculadosAlvo: [...noAlvo.values()].filter((m) => m.situacao === CURSANDO).length,
    rematriculados: rematriculados.sort(porNome),
    novos: novos.sort(porNome),
    concluintes: concluintes.sort(porNome),
    naoRematriculados: naoRematriculados.sort(porNome),
    porTurmaBase: [...porTurmaBase.values()].sort((a, b) => a.turma.localeCompare(b.turma)),
    porTurmaAlvo: [...porTurmaAlvo.values()].sort((a, b) => a.turma.localeCompare(b.turma)),
  };
}
