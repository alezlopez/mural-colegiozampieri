import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ClienteMhund,
  type MhundAluno,
  type MhundCurso,
  type MhundGrade,
  type MhundMatricula,
  type MhundProfessor,
  type MhundResponsavel,
} from "./mhund";

// Copia da Mhund para o hub: alunos, responsável financeiro (celular e CPF, usados no login do app), turmas,
// disciplinas, professores, grade (quem dá o quê) e matrículas. Substitui o antigo fluxo semanal do n8n.
// Regras da API (verificadas): sem data, as listagens devolvem só o que mudou desde a última consulta; com
// /{ano}/{desde} devolvem tudo o que mudou desde "desde". Coleta completa de matrículas só entre 18h e 8h;
// de dia, no máximo 30 dias para trás. Por isso a sincronização completa roda de madrugada.
// Mantém alunos em dia: aluno novo cursando entra; quem deixou de "cursar" (situação ≠ L) perde o acesso ao app;
// troca de turma e de responsável financeiro são atualizadas. Alunos que não existem na Mhund (cadastrados à mão
// aqui) não são tocados.

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

// Celular → 55 + DDD + número (corrige máscara, texto, DDD repetido e falta do 9). Mesma regra do antigo Code node.
export function celular(bruto: unknown) {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.slice(0, 2) === d.slice(2, 4)) d = d.slice(2);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + "9" + d.slice(2);
  return d.length === 11 && d[2] === "9" ? "55" + d : null;
}

// CPF só com dígitos; null se inválido (ex.: "999999999-99", usado como CPF em branco na Mhund).
export function cpfValido(bruto: unknown) {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (base: string) => ([...base].reduce((t, n, i) => t + Number(n) * (base.length + 1 - i), 0) * 10) % 11 % 10;
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]) ? d : null;
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
  /** false: só alunos e responsáveis são gravados (turmas, disciplinas, professores, grade e matrículas não). */
  pedagogico: boolean;
  turmas: number;
  turmasDesativadas: number;
  /** Turmas criadas à mão no painel que foram reconhecidas (mesmo nome e ano) e ligadas à da Mhund. */
  turmasLigadasAoPainel: number;
  disciplinas: number;
  professores: number;
  professoresSemEmail: number;
  emailsRepetidos: string[];
  vinculos: number;
  vinculosComMaisDeUmProfessor: number;
  matriculas: number;
  matriculasCursando: number;
  alunosNovos: number;
  alunosDesativados: string[];
  alunosReativados: string[];
  vinculosNovos: number;
  vinculosRemovidos: number;
  /** Alunos cursando cujo responsável financeiro está sem celular válido na Mhund (família não consegue entrar). */
  responsaveisSemCelular: string[];
  /** Alunos cursando sem responsável financeiro marcado na Mhund. */
  alunosSemResponsavelFinanceiro: string[];
};

export const DESDE_SEMPRE = "2020-01-01T00:00:00";

export async function sincronizarMhund(
  db: SupabaseClient,
  ano: number,
  {
    simular = false,
    desde = DESDE_SEMPRE,
    cliente = ClienteMhund.doAmbiente(),
    pedagogico = false,
  }: { simular?: boolean; desde?: string; cliente?: ClienteMhund; pedagogico?: boolean } = {},
): Promise<ResumoSincronizacao> {
  // Só a coleta completa sabe quais turmas deixaram de existir.
  const completa = desde === DESDE_SEMPRE;
  // Em sequência: a API da Mhund responde com erro a consultas simultâneas.
  const cursos = await cliente.listar<MhundCurso>(`Curso/${ano}/${desde}`);
  // Estrutura pedagógica (disciplinas, professores, grade, turmas e matrículas no hub) só com pedagogico=true.
  // Decisão de 10/2026: o pedagógico nasce no painel para 2027; da Mhund vêm só alunos e responsáveis. As turmas e
  // matrículas da Mhund continuam sendo LIDAS para saber quem está cursando e o nome da turma do aluno.
  const disciplinas = pedagogico
    ? await cliente.listar<{ idDaDisciplina: number; nomeDaDisciplina: string; abreviacaoDaDisciplina: string | null }>(
        `Disciplina/${ano}`, // sem variante por data; devolve sempre a lista toda
      )
    : [];
  const professoresBrutos = pedagogico ? await cliente.listar<MhundProfessor>(`Professor/${ano}/${desde}`) : [];
  const grade = pedagogico ? await cliente.listar<MhundGrade>(`Grade/${ano}/${desde}`) : [];
  const matriculasBrutas = await cliente.listar<MhundMatricula>(`Matricula/${ano}/${desde}`);
  const alunosMhund = await cliente.listar<MhundAluno>(`Aluno/${ano}/${desde}`);
  const responsaveisMhund = await cliente.listar<MhundResponsavel>(`Responsavel/${ano}/${desde}`);
  const agora = new Date().toISOString();

  // O que a secretaria editou no painel vale mais que a Mhund: esses registros não são regravados.
  const { data: profsHub, error: erroProfs } = await db.from("professores").select("mhund_id,email,editado_no_painel");
  if (erroProfs) throw new Error(`Erro ao ler professores: ${erroProfs.message}`);
  const profsEditados = new Set(profsHub.filter((x) => x.editado_no_painel && x.mhund_id).map((x) => x.mhund_id as number));
  const donoDoEmail = new Map(profsHub.filter((x) => x.email).map((x) => [x.email as string, x.mhund_id as number | null]));

  // Professores: a API devolve uma linha por turma/disciplina; um registro por professor, e-mail único.
  const professores = new Map<number, MhundProfessor>();
  for (const p of professoresBrutos) if (!professores.has(p.idDoProfessor)) professores.set(p.idDoProfessor, p);
  const emailsVistos = new Set<string>();
  const emailsRepetidos: string[] = [];
  const linhasProfessores = [...professores.values()].filter((p) => !profsEditados.has(p.idDoProfessor)).map((p) => {
    let email = p.email?.trim().toLowerCase() || null;
    // Repetido na Mhund, ou já usado aqui por outro professor (ex.: cadastrado à mão): fica sem e-mail.
    const dono = email ? donoDoEmail.get(email) : undefined;
    if (email && (emailsVistos.has(email) || (dono !== undefined && dono !== p.idDoProfessor))) {
      emailsRepetidos.push(email);
      email = null;
    }
    if (email) emailsVistos.add(email);
    // "ativo" fica de fora: o bloqueio feito pela secretaria no painel não é desfeito pela sincronização.
    return { mhund_id: p.idDoProfessor, nome: nomeProprio(p.nome), email };
  });

  // Turmas do painel: editadas não são regravadas; criadas à mão são ligadas à da Mhund de mesmo nome e ano
  // (em vez de duplicar). O nome que vale para os alunos é o do painel.
  const { data: turmasHub, error: erroTurmas } = await db.from("turmas").select("id,mhund_id,ano,nome,editado_no_painel");
  if (erroTurmas) throw new Error(`Erro ao ler turmas: ${erroTurmas.message}`);
  const chaveNome = (nome: string) => semAcento(nome).replace(/[º°ª]/g, "o").replace(/\s+/g, " ").trim();
  const mhundNoHub = new Set(turmasHub.filter((t) => t.mhund_id).map((t) => t.mhund_id as number));
  const turmasLigadas: { id: number; mhund_id: number }[] = [];
  for (const c of cursos) {
    if (mhundNoHub.has(c.idDoCurso)) continue;
    const manual = turmasHub.find(
      (t) => !t.mhund_id && t.ano === ano && chaveNome(t.nome as string) === chaveNome(c.descricaoDoCurso) && !turmasLigadas.some((l) => l.id === t.id),
    );
    if (manual) turmasLigadas.push({ id: manual.id as number, mhund_id: c.idDoCurso });
  }
  const turmasEditadas = new Map(
    turmasHub
      .filter((t) => t.editado_no_painel && t.mhund_id)
      .map((t) => [t.mhund_id as number, t.nome as string] as const),
  );
  for (const l of turmasLigadas) turmasEditadas.set(l.mhund_id, turmasHub.find((t) => t.id === l.id)!.nome as string);

  const linhasTurmas = cursos.filter((c) => !turmasEditadas.has(c.idDoCurso)).map((c) => ({
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
  const { data: discHub, error: erroDisc } = await db.from("disciplinas").select("mhund_id").eq("editado_no_painel", true);
  if (erroDisc) throw new Error(`Erro ao ler disciplinas: ${erroDisc.message}`);
  const discEditadas = new Set(discHub.map((x) => x.mhund_id as number));
  // "ativa" fica de fora: disciplina desativada no painel continua desativada.
  const linhasDisciplinas = disciplinas
    .filter((d) => !discEditadas.has(d.idDaDisciplina))
    .map((d) => ({ mhund_id: d.idDaDisciplina, nome: nomeProprio(d.nomeDaDisciplina), abreviacao: d.abreviacaoDaDisciplina }));

  // Situação de cada aluno da Mhund: cursa se tem alguma matrícula "L" no ano.
  const cursandoPorAluno = new Map<string, MhundMatricula | null>();
  for (const m of matriculasBrutas) {
    const codigo = String(m.idDoAluno);
    if (m.situacao === CURSANDO) cursandoPorAluno.set(codigo, m);
    else if (!cursandoPorAluno.has(codigo)) cursandoPorAluno.set(codigo, null);
  }
  const nomeDaTurma = new Map<number, string>([...linhasTurmas.map((t) => [t.mhund_id, t.nome] as const), ...turmasEditadas]);

  const { data: alunosHub, error: erroAlunos } = await db.from("alunos").select("codigo,nome,ativo,turma");
  if (erroAlunos) throw new Error(`Erro ao ler alunos: ${erroAlunos.message}`);
  const hub = new Map(alunosHub.map((a) => [a.codigo as string, a as { codigo: string; nome: string; ativo: boolean; turma: string }]));
  const dadosAluno = new Map(alunosMhund.map((a) => [String(a.idDoAluno), a]));

  const alunosDesativados: string[] = [];
  const alunosReativados: string[] = [];
  const novosAlunos: { codigo: string; nome: string; turma: string; ativo: boolean }[] = [];
  const atualizacoesAlunos: { codigo: string; nome: string; ativo: boolean; turma: string }[] = [];
  for (const [codigo, cursando] of cursandoPorAluno) {
    const atual = hub.get(codigo);
    const mhund = dadosAluno.get(codigo);
    const nome = mhund?.nome ? nomeProprio(mhund.nome) : atual?.nome;
    const turma = cursando
      ? nomeDaTurma.get(cursando.idDoCurso) ?? mhund?.descricaoUltimoCurso?.trim() ?? atual?.turma
      : atual?.turma;
    if (!atual) {
      // Só entra quem está cursando e tem nome e turma (os dados do aluno vêm na mesma coleta).
      if (cursando && nome && turma) novosAlunos.push({ codigo, nome, turma, ativo: true });
      continue;
    }
    const ativo = Boolean(cursando);
    if (atual.ativo && !ativo) alunosDesativados.push(codigo);
    if (!atual.ativo && ativo) alunosReativados.push(codigo);
    if (atual.ativo !== ativo || atual.turma !== turma || (nome && atual.nome !== nome)) {
      atualizacoesAlunos.push({ codigo, nome: nome ?? atual.nome, ativo, turma: turma ?? atual.turma });
    }
  }

  // Responsável financeiro de cada aluno (o que entra no app com o próprio celular ou CPF).
  const financeiro = new Map<string, MhundResponsavel>();
  for (const r of responsaveisMhund) {
    if (r.eResponsavelFinanceiro === "Sim" && !financeiro.has(String(r.idDoAluno))) financeiro.set(String(r.idDoAluno), r);
  }
  const { data: vinculosHub, error: erroVinculos } = await db.from("aluno_responsaveis").select("aluno_codigo,telefone,nome,cpf");
  if (erroVinculos) throw new Error(`Erro ao ler responsáveis: ${erroVinculos.message}`);
  const vinculosAtuais = new Map<string, { telefone: string; nome: string | null; cpf: string | null }[]>();
  for (const v of vinculosHub) {
    const lista = vinculosAtuais.get(v.aluno_codigo as string) ?? [];
    lista.push(v as { telefone: string; nome: string | null; cpf: string | null });
    vinculosAtuais.set(v.aluno_codigo as string, lista);
  }

  const codigosNoHub = new Set([...hub.keys(), ...novosAlunos.map((a) => a.codigo)]);
  const vinculosParaGravar: { aluno_codigo: string; telefone: string; nome: string | null; cpf: string | null }[] = [];
  const vinculosParaRemover: { aluno_codigo: string; telefone: string }[] = [];
  const responsaveisSemCelular: string[] = [];
  for (const [codigo, r] of financeiro) {
    if (!codigosNoHub.has(codigo)) continue;
    const telefone = celular(r.celular);
    const atuais = vinculosAtuais.get(codigo) ?? [];
    if (!telefone) {
      // Mantém o acesso que já existe até a secretaria corrigir o celular na Mhund.
      if (cursandoPorAluno.get(codigo)) responsaveisSemCelular.push(codigo);
      continue;
    }
    const nomeResp = r.nome ? nomeProprio(r.nome) : null;
    const cpf = cpfValido(r.cpf);
    const igual = atuais.find((v) => v.telefone === telefone);
    if (!igual || igual.nome !== nomeResp || igual.cpf !== cpf) {
      vinculosParaGravar.push({ aluno_codigo: codigo, telefone, nome: nomeResp, cpf });
    }
    // Trocou o responsável financeiro ou o celular: o número antigo perde o acesso a este aluno.
    for (const v of atuais) if (v.telefone !== telefone) vinculosParaRemover.push({ aluno_codigo: codigo, telefone: v.telefone });
  }
  const alunosSemResponsavelFinanceiro = completa
    ? [...cursandoPorAluno.entries()].filter(([c, m]) => m && codigosNoHub.has(c) && !financeiro.has(c)).map(([c]) => c)
    : [];

  const paresGrade = new Map<string, MhundGrade>();
  let vinculosComMaisDeUmProfessor = 0;
  for (const g of grade) {
    const chave = `${g.idDoCurso}:${g.idDaDisciplina}`;
    const existente = paresGrade.get(chave);
    if (existente && existente.idDoProfessor !== g.idDoProfessor) vinculosComMaisDeUmProfessor++;
    if (!existente || (!existente.idDoProfessor && g.idDoProfessor)) paresGrade.set(chave, g);
  }

  const { data: turmasExistentes } = await db.from("turmas").select("mhund_id,editado_no_painel").eq("ano", ano).eq("ativa", true).not("mhund_id", "is", null);
  const idsCursos = new Set(cursos.map((c) => c.idDoCurso));
  const turmasDesativadas = completa && pedagogico
    ? (turmasExistentes ?? []).filter((t) => !idsCursos.has(t.mhund_id as number) && !t.editado_no_painel).length
    : 0;

  const resumo: ResumoSincronizacao = {
    ano,
    simulacao: simular,
    pedagogico,
    turmas: cursos.length,
    turmasLigadasAoPainel: turmasLigadas.length,
    turmasDesativadas,
    disciplinas: disciplinas.length,
    professores: linhasProfessores.length,
    professoresSemEmail: linhasProfessores.filter((p) => !p.email).length,
    emailsRepetidos: [...new Set(emailsRepetidos)],
    vinculos: paresGrade.size,
    vinculosComMaisDeUmProfessor,
    matriculas: matriculasBrutas.length,
    matriculasCursando: matriculasBrutas.filter((m) => m.situacao === CURSANDO).length,
    alunosNovos: novosAlunos.length,
    alunosDesativados,
    alunosReativados,
    vinculosNovos: vinculosParaGravar.length,
    vinculosRemovidos: vinculosParaRemover.length,
    responsaveisSemCelular,
    alunosSemResponsavelFinanceiro,
  };
  if (simular) return resumo;

  const falhou = (etapa: string, e: { message: string } | null) => {
    if (e) throw new Error(`Sincronização (${etapa}): ${e.message}`);
  };

  for (let i = 0; i < novosAlunos.length; i += 500) {
    falhou("alunos novos", (await db.from("alunos").insert(novosAlunos.slice(i, i + 500))).error);
  }
  for (const novo of novosAlunos) hub.set(novo.codigo, novo);

  if (pedagogico) {
    for (const l of turmasLigadas) {
      falhou("ligar turma do painel", (await db.from("turmas").update({ mhund_id: l.mhund_id }).eq("id", l.id)).error);
    }
    falhou("turmas", (await db.from("turmas").upsert(linhasTurmas, { onConflict: "mhund_id" })).error);
    if (turmasDesativadas > 0) {
      falhou(
        "turmas antigas",
        (
          await db
            .from("turmas")
            .update({ ativa: false })
            .eq("ano", ano)
            .eq("editado_no_painel", false)
            .not("mhund_id", "in", `(${[...idsCursos].join(",")})`)
        ).error,
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

    // Vínculos atribuídos ou removidos no painel ficam como a secretaria deixou.
    const [{ data: vincEditados }, { data: vincRemovidos }] = await Promise.all([
      db.from("turma_disciplinas").select("turma_id,disciplina_id").eq("editado_no_painel", true),
      db.from("vinculos_removidos").select("turma_id,disciplina_id"),
    ]);
    const doPainel = new Set([...(vincEditados ?? []), ...(vincRemovidos ?? [])].map((v) => `${v.turma_id}:${v.disciplina_id}`));

    const linhasVinculos = [...paresGrade.values()]
      .filter((g) => idTurma.has(g.idDoCurso) && idDisciplina.has(g.idDaDisciplina))
      .filter((g) => !doPainel.has(`${idTurma.get(g.idDoCurso)}:${idDisciplina.get(g.idDaDisciplina)}`))
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
  }

  for (const a of atualizacoesAlunos) {
    falhou("alunos", (await db.from("alunos").update({ nome: a.nome, ativo: a.ativo, turma: a.turma }).eq("codigo", a.codigo)).error);
  }

  for (let i = 0; i < vinculosParaGravar.length; i += 500) {
    falhou(
      "responsáveis",
      (await db.from("aluno_responsaveis").upsert(vinculosParaGravar.slice(i, i + 500), { onConflict: "aluno_codigo,telefone" })).error,
    );
  }
  for (const v of vinculosParaRemover) {
    falhou(
      "responsáveis antigos",
      (await db.from("aluno_responsaveis").delete().eq("aluno_codigo", v.aluno_codigo).eq("telefone", v.telefone)).error,
    );
  }

  return resumo;
}
