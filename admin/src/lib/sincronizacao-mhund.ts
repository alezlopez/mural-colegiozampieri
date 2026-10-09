import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ClienteMhund, type MhundCurso, type MhundGrade, type MhundMatricula, type MhundProfessor } from "./mhund";

// Copia da Mhund para o hub: turmas, disciplinas, professores, grade (quem dá o quê) e matrículas.
// Regras da API (verificadas): sem data, as listagens devolvem só o que mudou desde a última consulta; com
// /{ano}/{desde} devolvem tudo o que mudou desde "desde". Coleta completa de matrículas só entre 18h e 8h;
// de dia, no máximo 30 dias para trás. Por isso a sincronização completa roda de madrugada.
// Também mantém alunos.ativo/turma em dia: aluno que deixou de "cursar" (situação ≠ L) perde o acesso ao app.
// Alunos que não existem na Mhund (cadastrados à mão aqui) não são tocados.

const CURSANDO = "L";

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
function nomeProprio(bruto: string) {
  return bruto
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function segmentoDoCurso(c: Pick<MhundCurso, "segmento" | "descricaoDoCurso">) {
  const s = semAcento(`${c.segmento ?? ""} ${c.descricaoDoCurso}`);
  if (s.includes("infantil") || s.includes("jardim") || s.includes("pre ")) return "infantil";
  if (s.includes("medio")) return "medio";
  if (/fundamental ii\b|fundamental 2/.test(s)) return "fundamental2";
  if (/fundamental i\b|fundamental 1/.test(s)) return "fundamental1";
  return "fundamental1";
}

function turno(bruto: string | null) {
  const t = semAcento(bruto ?? "");
  if (t.startsWith("ma")) return "manha";
  if (t.startsWith("ta") || t.startsWith("ve")) return "tarde";
  return null;
}

export type ResumoSincronizacao = {
  ano: number;
  simulacao: boolean;
  turmas: number;
  turmasDesativadas: number;
  disciplinas: number;
  professores: number;
  professoresSemEmail: number;
  emailsRepetidos: string[];
  vinculos: number;
  vinculosComMaisDeUmProfessor: number;
  matriculas: number;
  matriculasCursando: number;
  alunosDesativados: string[];
  alunosReativados: string[];
  alunosForaDoHub: number;
};

export const DESDE_SEMPRE = "2020-01-01T00:00:00";

export async function sincronizarMhund(
  db: SupabaseClient,
  ano: number,
  {
    simular = false,
    desde = DESDE_SEMPRE,
    cliente = ClienteMhund.doAmbiente(),
  }: { simular?: boolean; desde?: string; cliente?: ClienteMhund } = {},
): Promise<ResumoSincronizacao> {
  // Só a coleta completa sabe quais turmas deixaram de existir.
  const completa = desde === DESDE_SEMPRE;
  // Em sequência: a API da Mhund responde com erro a consultas simultâneas.
  const cursos = await cliente.listar<MhundCurso>(`Curso/${ano}/${desde}`);
  const disciplinas = await cliente.listar<{ idDaDisciplina: number; nomeDaDisciplina: string; abreviacaoDaDisciplina: string | null }>(
    `Disciplina/${ano}`, // sem variante por data; devolve sempre a lista toda
  );
  const professoresBrutos = await cliente.listar<MhundProfessor>(`Professor/${ano}/${desde}`);
  const grade = await cliente.listar<MhundGrade>(`Grade/${ano}/${desde}`);
  const matriculasBrutas = await cliente.listar<MhundMatricula>(`Matricula/${ano}/${desde}`);
  const agora = new Date().toISOString();

  // Professores: a API devolve uma linha por turma/disciplina; um registro por professor, e-mail único.
  const professores = new Map<number, MhundProfessor>();
  for (const p of professoresBrutos) if (!professores.has(p.idDoProfessor)) professores.set(p.idDoProfessor, p);
  const emailsVistos = new Set<string>();
  const emailsRepetidos: string[] = [];
  const linhasProfessores = [...professores.values()].map((p) => {
    let email = p.email?.trim().toLowerCase() || null;
    if (email && emailsVistos.has(email)) {
      emailsRepetidos.push(email);
      email = null;
    }
    if (email) emailsVistos.add(email);
    return { mhund_id: p.idDoProfessor, nome: nomeProprio(p.nome), email, ativo: true };
  });

  const linhasTurmas = cursos.map((c) => ({
    mhund_id: c.idDoCurso,
    ano,
    nome: c.descricaoDoCurso.replace(/\s+/g, " ").trim(),
    nome_reduzido: c.nomeReduzido,
    serie: c.descricaoDaSerieDoCurso,
    letra: c.turma,
    turno: turno(c.turno),
    segmento: segmentoDoCurso(c),
    ativa: true,
    sincronizado_em: agora,
  }));
  const linhasDisciplinas = disciplinas.map((d) => ({
    mhund_id: d.idDaDisciplina,
    nome: nomeProprio(d.nomeDaDisciplina),
    abreviacao: d.abreviacaoDaDisciplina,
    ativa: true,
  }));

  // Situação de cada aluno da Mhund: cursa se tem alguma matrícula "L" no ano.
  const cursandoPorAluno = new Map<string, MhundMatricula | null>();
  for (const m of matriculasBrutas) {
    const codigo = String(m.idDoAluno);
    if (m.situacao === CURSANDO) cursandoPorAluno.set(codigo, m);
    else if (!cursandoPorAluno.has(codigo)) cursandoPorAluno.set(codigo, null);
  }
  const nomeDaTurma = new Map(linhasTurmas.map((t) => [t.mhund_id, t.nome]));

  const { data: alunosHub, error: erroAlunos } = await db.from("alunos").select("codigo,ativo,turma");
  if (erroAlunos) throw new Error(`Erro ao ler alunos: ${erroAlunos.message}`);
  const hub = new Map(alunosHub.map((a) => [a.codigo as string, a as { codigo: string; ativo: boolean; turma: string }]));
  const alunosDesativados: string[] = [];
  const alunosReativados: string[] = [];
  const atualizacoesAlunos: { codigo: string; ativo: boolean; turma: string }[] = [];
  for (const [codigo, cursando] of cursandoPorAluno) {
    const atual = hub.get(codigo);
    if (!atual) continue;
    const ativo = Boolean(cursando);
    const turma = cursando ? nomeDaTurma.get(cursando.idDoCurso) ?? atual.turma : atual.turma;
    if (atual.ativo && !ativo) alunosDesativados.push(codigo);
    if (!atual.ativo && ativo) alunosReativados.push(codigo);
    if (atual.ativo !== ativo || atual.turma !== turma) atualizacoesAlunos.push({ codigo, ativo, turma });
  }
  const alunosForaDoHub = [...cursandoPorAluno.entries()].filter(([c, m]) => m && !hub.has(c)).length;

  const paresGrade = new Map<string, MhundGrade>();
  let vinculosComMaisDeUmProfessor = 0;
  for (const g of grade) {
    const chave = `${g.idDoCurso}:${g.idDaDisciplina}`;
    const existente = paresGrade.get(chave);
    if (existente && existente.idDoProfessor !== g.idDoProfessor) vinculosComMaisDeUmProfessor++;
    if (!existente || (!existente.idDoProfessor && g.idDoProfessor)) paresGrade.set(chave, g);
  }

  const { data: turmasExistentes } = await db.from("turmas").select("mhund_id").eq("ano", ano).eq("ativa", true).not("mhund_id", "is", null);
  const idsCursos = new Set(cursos.map((c) => c.idDoCurso));
  const turmasDesativadas = completa ? (turmasExistentes ?? []).filter((t) => !idsCursos.has(t.mhund_id as number)).length : 0;

  const resumo: ResumoSincronizacao = {
    ano,
    simulacao: simular,
    turmas: linhasTurmas.length,
    turmasDesativadas,
    disciplinas: linhasDisciplinas.length,
    professores: linhasProfessores.length,
    professoresSemEmail: linhasProfessores.filter((p) => !p.email).length,
    emailsRepetidos: [...new Set(emailsRepetidos)],
    vinculos: paresGrade.size,
    vinculosComMaisDeUmProfessor,
    matriculas: matriculasBrutas.length,
    matriculasCursando: matriculasBrutas.filter((m) => m.situacao === CURSANDO).length,
    alunosDesativados,
    alunosReativados,
    alunosForaDoHub,
  };
  if (simular) return resumo;

  const falhou = (etapa: string, e: { message: string } | null) => {
    if (e) throw new Error(`Sincronização (${etapa}): ${e.message}`);
  };

  falhou("turmas", (await db.from("turmas").upsert(linhasTurmas, { onConflict: "mhund_id" })).error);
  if (turmasDesativadas > 0) {
    falhou(
      "turmas antigas",
      (await db.from("turmas").update({ ativa: false }).eq("ano", ano).not("mhund_id", "in", `(${[...idsCursos].join(",")})`)).error,
    );
  }
  // Turma nova ganha o horário padrão do turno (editável depois no painel).
  const { data: modelos } = await db.from("modelos_horario").select("id,nome");
  for (const [turnoTurma, nomeModelo] of [["manha", "Manhã"], ["tarde", "Tarde"]] as const) {
    const modelo = modelos?.find((m) => m.nome === nomeModelo);
    if (modelo) {
      await db.from("turmas").update({ modelo_horario_id: modelo.id }).eq("turno", turnoTurma).is("modelo_horario_id", null);
    }
  }
  falhou("disciplinas", (await db.from("disciplinas").upsert(linhasDisciplinas, { onConflict: "mhund_id" })).error);
  // O e-mail fica livre se outro professor já o usa aqui (ex.: cadastrado à mão).
  falhou("professores", (await db.from("professores").upsert(linhasProfessores, { onConflict: "mhund_id" })).error);

  // Mapas Mhund → ids do hub.
  const [{ data: t }, { data: d }, { data: p }] = await Promise.all([
    db.from("turmas").select("id,mhund_id").not("mhund_id", "is", null),
    db.from("disciplinas").select("id,mhund_id").not("mhund_id", "is", null),
    db.from("professores").select("id,mhund_id").not("mhund_id", "is", null),
  ]);
  const idTurma = new Map((t ?? []).map((x) => [x.mhund_id as number, x.id as number]));
  const idDisciplina = new Map((d ?? []).map((x) => [x.mhund_id as number, x.id as number]));
  const idProfessor = new Map((p ?? []).map((x) => [x.mhund_id as number, x.id as number]));

  const linhasVinculos = [...paresGrade.values()]
    .filter((g) => idTurma.has(g.idDoCurso) && idDisciplina.has(g.idDaDisciplina))
    .map((g) => ({
      turma_id: idTurma.get(g.idDoCurso)!,
      disciplina_id: idDisciplina.get(g.idDaDisciplina)!,
      professor_id: g.idDoProfessor ? idProfessor.get(g.idDoProfessor) ?? null : null,
    }));
  for (let i = 0; i < linhasVinculos.length; i += 500) {
    falhou("grade", (await db.from("turma_disciplinas").upsert(linhasVinculos.slice(i, i + 500), { onConflict: "turma_id,disciplina_id" })).error);
  }

  const linhasMatriculas = matriculasBrutas
    .filter((m) => hub.has(String(m.idDoAluno)) && idTurma.has(m.idDoCurso))
    .map((m) => ({
      aluno_codigo: String(m.idDoAluno),
      turma_id: idTurma.get(m.idDoCurso)!,
      ano,
      numero_chamada: m.numeroDeChamada,
      situacao: m.situacao,
      ativa: m.situacao === CURSANDO,
    }));
  for (let i = 0; i < linhasMatriculas.length; i += 500) {
    falhou("matrículas", (await db.from("matriculas").upsert(linhasMatriculas.slice(i, i + 500), { onConflict: "aluno_codigo,turma_id" })).error);
  }

  for (const a of atualizacoesAlunos) {
    falhou("alunos", (await db.from("alunos").update({ ativo: a.ativo, turma: a.turma }).eq("codigo", a.codigo)).error);
  }

  return resumo;
}
