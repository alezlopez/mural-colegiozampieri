import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "./ler-tudo";
import type { MhundAluno, MhundResponsavel } from "./mhund";

// Importação do cadastro da Mhund para o painel (Fase A). Regra: só PREENCHE o que está vazio — nada que a
// secretaria editou no painel é sobrescrito. O que a Mhund oferece (verificado em 16/10/2026 com ?campos=1):
// aluno → data de nascimento; responsáveis (pai, mãe e outros) → nome, CPF, e-mail, celular, nascimento e relação.
// CPF/RG/endereço/naturalidade do aluno e RG/estado civil/naturalidade dos pais não existem lá: digitação no painel.

type Formatadores = { nomeProprio: (s: string) => string; celular: (s: unknown) => string | null; cpfValido: (s: unknown) => string | null };

export type ResumoCadastro = {
  nascimentosPreenchidos: number;
  responsaveisNovos: number;
  responsaveisCompletados: number;
  vinculosNovos: number;
  responsaveisSemNome: number;
};

/** "2015-03-10T00:00:00" ou "10/03/2015" → "2015-03-10"; datas vazias da Mhund ("0001-01-01") viram null. */
export function dataMhund(bruto: unknown): string | null {
  const t = String(bruto ?? "").trim();
  let iso: string | null = null;
  const m1 = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) iso = `${m1[1]}-${m1[2]}-${m1[3]}`;
  else if (m2) iso = `${m2[3]}-${m2[2]}-${m2[1]}`;
  if (!iso) return null;
  const ano = Number(iso.slice(0, 4));
  const d = new Date(`${iso}T12:00:00Z`);
  return ano >= 1900 && ano <= new Date().getFullYear() && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Relação da Mhund → pai / mãe / outro (com a descrição original). */
export function parentescoMhund(relacao: unknown): { parentesco: "pai" | "mae" | "outro"; parentesco_descricao: string | null } {
  const t = String(relacao ?? "").trim();
  const s = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/^pai\b/.test(s)) return { parentesco: "pai", parentesco_descricao: null };
  if (/^mae\b/.test(s)) return { parentesco: "mae", parentesco_descricao: null };
  return { parentesco: "outro", parentesco_descricao: t || null };
}

const emailValido = (e: unknown) => {
  const t = String(e ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : null;
};

type Pessoa = { id: number; mhund_id: number | null; cpf: string | null; nascimento: string | null; celular: string | null; email: string | null };

export async function importarCadastro(
  db: SupabaseClient,
  { alunos, responsaveis, codigosValidos, simular }: { alunos: MhundAluno[]; responsaveis: MhundResponsavel[]; codigosValidos: Set<string>; simular: boolean },
  f: Formatadores,
): Promise<ResumoCadastro> {
  const resumo: ResumoCadastro = { nascimentosPreenchidos: 0, responsaveisNovos: 0, responsaveisCompletados: 0, vinculosNovos: 0, responsaveisSemNome: 0 };

  // 1) Nascimento do aluno, só onde está vazio.
  const dados = await lerTudo<{ aluno_codigo: string; nascimento: string | null }>((de, ate) =>
    db.from("aluno_dados").select("aluno_codigo,nascimento").order("aluno_codigo").range(de, ate),
  );
  const nascimentoAtual = new Map(dados.map((d) => [d.aluno_codigo, d.nascimento]));
  const nascimentos = alunos
    .map((a) => ({ aluno_codigo: String(a.idDoAluno), nascimento: dataMhund(a.dataDeNascimento) }))
    .filter((a) => a.nascimento && codigosValidos.has(a.aluno_codigo) && !nascimentoAtual.get(a.aluno_codigo));
  resumo.nascimentosPreenchidos = nascimentos.length;
  if (!simular) {
    for (let i = 0; i < nascimentos.length; i += 500) {
      const { error } = await db.from("aluno_dados").upsert(nascimentos.slice(i, i + 500), { onConflict: "aluno_codigo" });
      if (error) throw new Error(`Erro ao gravar nascimentos: ${error.message}`);
    }
  }

  // 2) Pessoas: a Mhund repete o responsável em cada filho; junta pelo id dela e pelo CPF.
  type Dado = { mhund_id: number; nome: string; cpf: string | null; nascimento: string | null; celular: string | null; email: string | null };
  const porMhund = new Map<number, Dado>();
  for (const r of responsaveis) {
    const id = Number(r.idDoResponsavel);
    if (!Number.isInteger(id) || id <= 0) continue;
    const nome = r.nome?.trim() ? f.nomeProprio(r.nome) : "";
    const atual = porMhund.get(id);
    const novo: Dado = {
      mhund_id: id,
      nome: atual?.nome || nome,
      cpf: atual?.cpf ?? f.cpfValido(r.cpf),
      nascimento: atual?.nascimento ?? dataMhund(r.dataDeNascimento),
      celular: atual?.celular ?? f.celular(r.celular),
      email: atual?.email ?? emailValido(r.email),
    };
    porMhund.set(id, novo);
  }

  const existentes = await lerTudo<Pessoa>((de, ate) =>
    db.from("responsaveis").select("id,mhund_id,cpf,nascimento,celular,email").order("id").range(de, ate),
  );
  const porMhundId = new Map(existentes.filter((p) => p.mhund_id).map((p) => [p.mhund_id as number, p]));
  const porCpf = new Map(existentes.filter((p) => p.cpf).map((p) => [p.cpf as string, p]));

  const pessoaDoMhund = new Map<number, number>(); // idDoResponsavel → responsaveis.id
  const novos: Dado[] = [];
  const cpfsNovos = new Map<string, Dado>();
  for (const d of porMhund.values()) {
    const p = porMhundId.get(d.mhund_id) ?? (d.cpf ? porCpf.get(d.cpf) : undefined);
    if (p) {
      pessoaDoMhund.set(d.mhund_id, p.id);
      // Completa só o que está vazio (e liga ao id da Mhund).
      const patch: Record<string, unknown> = {};
      if (!p.mhund_id && !porMhundId.has(d.mhund_id)) patch.mhund_id = d.mhund_id;
      if (!p.cpf && d.cpf && !porCpf.has(d.cpf)) patch.cpf = d.cpf;
      if (!p.nascimento && d.nascimento) patch.nascimento = d.nascimento;
      if (!p.celular && d.celular) patch.celular = d.celular;
      if (!p.email && d.email) patch.email = d.email;
      if (Object.keys(patch).length > 0) {
        resumo.responsaveisCompletados++;
        if (!simular) {
          const { error } = await db.from("responsaveis").update(patch).eq("id", p.id);
          if (error) throw new Error(`Erro ao completar responsável: ${error.message}`);
        }
      }
      continue;
    }
    if (d.nome.length < 3) {
      resumo.responsaveisSemNome++;
      continue;
    }
    // Mesmo CPF com dois ids na Mhund (cadastro duplicado lá): vira uma pessoa só aqui.
    if (d.cpf && cpfsNovos.has(d.cpf)) continue;
    if (d.cpf) cpfsNovos.set(d.cpf, d);
    novos.push(d);
  }
  resumo.responsaveisNovos = novos.length;

  if (!simular) {
    for (let i = 0; i < novos.length; i += 500) {
      const { data, error } = await db.from("responsaveis").insert(novos.slice(i, i + 500)).select("id,mhund_id,cpf");
      if (error) throw new Error(`Erro ao cadastrar responsáveis: ${error.message}`);
      for (const p of data ?? []) pessoaDoMhund.set(p.mhund_id as number, p.id as number);
    }
    // Ids da Mhund que caíram numa pessoa de mesmo CPF.
    for (const d of porMhund.values()) {
      if (!pessoaDoMhund.has(d.mhund_id) && d.cpf) {
        const mesmo = cpfsNovos.get(d.cpf);
        const id = mesmo ? pessoaDoMhund.get(mesmo.mhund_id) : undefined;
        if (id) pessoaDoMhund.set(d.mhund_id, id);
      }
    }
  }

  // 3) Vínculos aluno ↔ pessoa que ainda não existem. Os que a secretaria já criou ou ajustou ficam como estão.
  const vinculos = await lerTudo<{ aluno_codigo: string; responsavel_id: number; financeiro: boolean }>((de, ate) =>
    db.from("aluno_vinculos").select("aluno_codigo,responsavel_id,financeiro").order("aluno_codigo").order("responsavel_id").range(de, ate),
  );
  const tem = new Set(vinculos.map((v) => `${v.aluno_codigo}:${v.responsavel_id}`));
  const comFinanceiro = new Set(vinculos.filter((v) => v.financeiro).map((v) => v.aluno_codigo));
  const linhas: { aluno_codigo: string; responsavel_id: number; parentesco: string; parentesco_descricao: string | null; financeiro: boolean; acesso_app: boolean }[] = [];
  for (const r of responsaveis) {
    const codigo = String(r.idDoAluno);
    const mhundId = Number(r.idDoResponsavel);
    if (!codigosValidos.has(codigo)) continue;
    // Na simulação as pessoas novas ainda não têm id: conta pelo id da Mhund.
    const pessoa = pessoaDoMhund.get(mhundId) ?? (simular && porMhund.has(mhundId) ? -mhundId : undefined);
    if (!pessoa) continue;
    const chave = `${codigo}:${pessoa}`;
    if (tem.has(chave)) continue;
    tem.add(chave);
    const financeiro = r.eResponsavelFinanceiro === "Sim" && !comFinanceiro.has(codigo);
    if (financeiro) comFinanceiro.add(codigo);
    // Acesso ao app: o do financeiro já vem da sincronização; os demais a secretaria libera no cadastro.
    linhas.push({ aluno_codigo: codigo, responsavel_id: pessoa, ...parentescoMhund(r.relacao), financeiro, acesso_app: financeiro });
  }
  resumo.vinculosNovos = linhas.length;
  if (!simular) {
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await db.from("aluno_vinculos").insert(linhas.slice(i, i + 500));
      if (error) throw new Error(`Erro ao vincular responsáveis: ${error.message}`);
    }
  }
  return resumo;
}
