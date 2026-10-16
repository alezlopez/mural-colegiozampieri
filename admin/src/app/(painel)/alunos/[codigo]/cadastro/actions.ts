"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirArea } from "@/lib/auth";
import { normalizarCpf } from "@/lib/cpf";
import { ensalar } from "@/lib/ensalamento";
import { normalizarTelefone } from "@/lib/telefone";

const ESTADOS_CIVIS = new Set(["solteiro", "casado", "uniao_estavel", "divorciado", "separado", "viuvo"]);
const PARENTESCOS = new Set(["pai", "mae", "outro"]);

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? "").replace(/\s+/g, " ").trim() || null;

function voltar(codigo: string, chave: "salvo" | "erro", msg: string, ancora = ""): never {
  redirect(`/alunos/${encodeURIComponent(codigo)}/cadastro?${chave}=${encodeURIComponent(msg)}${ancora ? `#${ancora}` : ""}` as Route);
}

function data(f: FormData, campo: string) {
  const v = texto(f, campo);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** CPF opcional: vazio = null; preenchido e inválido = erro. */
function cpfOpcional(f: FormData, codigo: string, ancora: string) {
  const bruto = texto(f, "cpf");
  if (!bruto) return null;
  const cpf = normalizarCpf(bruto);
  if (!cpf) voltar(codigo, "erro", "CPF inválido: confira os números.", ancora);
  return cpf;
}

export async function salvarDadosAluno(formData: FormData) {
  const { supabase } = await exigirArea("secretaria", "editar");
  const codigo = String(formData.get("codigo") ?? "");
  const cpf = cpfOpcional(formData, codigo, "dados");
  const cep = (texto(formData, "cep") ?? "").replace(/\D/g, "") || null;
  if (cep && cep.length !== 8) voltar(codigo, "erro", "CEP deve ter 8 números.", "dados");
  const uf = texto(formData, "uf")?.toUpperCase() ?? null;
  if (uf && !/^[A-Z]{2}$/.test(uf)) voltar(codigo, "erro", "UF deve ter 2 letras.", "dados");

  const { error } = await supabase.from("aluno_dados").upsert({
    aluno_codigo: codigo,
    nome_social: texto(formData, "nome_social"),
    sexo: ["M", "F"].includes(String(formData.get("sexo"))) ? String(formData.get("sexo")) : null,
    nascimento: data(formData, "nascimento"),
    naturalidade: texto(formData, "naturalidade"),
    nacionalidade: texto(formData, "nacionalidade") ?? "Brasileira",
    cpf,
    rg: texto(formData, "rg"),
    cep,
    logradouro: texto(formData, "logradouro"),
    numero: texto(formData, "numero"),
    complemento: texto(formData, "complemento"),
    bairro: texto(formData, "bairro"),
    cidade: texto(formData, "cidade"),
    uf,
    atualizado_em: new Date().toISOString(),
  });
  if (error) {
    console.error("[cadastro] aluno", error);
    voltar(codigo, "erro", error.code === "23505" ? "Esse CPF já está no cadastro de outro aluno." : "Não foi possível salvar.", "dados");
  }
  revalidatePath(`/alunos/${codigo}`, "layout");
  voltar(codigo, "salvo", "Dados do aluno salvos.", "dados");
}

export async function matricularAluno(formData: FormData) {
  const { supabase } = await exigirArea("secretaria", "editar");
  const codigo = String(formData.get("codigo") ?? "");
  const turmaId = Number(formData.get("turma_id"));
  const { data: turma } = await supabase.from("turmas").select("id,ano,nome").eq("id", turmaId).maybeSingle();
  if (!turma) voltar(codigo, "erro", "Escolha a turma.", "matricula");
  const error = await ensalar(supabase, [codigo], turma as { id: number; ano: number; nome: string });
  if (error) {
    console.error("[cadastro] matrícula", error);
    voltar(codigo, "erro", "Não foi possível matricular.", "matricula");
  }
  revalidatePath("/", "layout");
  voltar(codigo, "salvo", `Matriculado em ${turma.nome} (${turma.ano}).`, "matricula");
}

/**
 * Acesso ao app pelo celular do responsável (tabela usada pelo login da família). Só mexe nas linhas criadas pelo
 * painel; a do responsável financeiro que vem da Mhund continua com a sincronização.
 */
async function acertarAcessoApp(db: SupabaseClient, alunoCodigo: string, r: { nome: string; cpf: string | null; celular: string | null }, ativo: boolean, celularAntigo?: string | null) {
  if (celularAntigo && celularAntigo !== r.celular) {
    await db.from("aluno_responsaveis").delete().eq("aluno_codigo", alunoCodigo).eq("telefone", celularAntigo).eq("origem", "painel");
  }
  if (!r.celular) return;
  if (!ativo) {
    await db.from("aluno_responsaveis").delete().eq("aluno_codigo", alunoCodigo).eq("telefone", r.celular).eq("origem", "painel");
    return;
  }
  const { data: existe } = await db.from("aluno_responsaveis").select("origem").eq("aluno_codigo", alunoCodigo).eq("telefone", r.celular).maybeSingle();
  if (!existe) await db.from("aluno_responsaveis").insert({ aluno_codigo: alunoCodigo, telefone: r.celular, nome: r.nome, cpf: r.cpf, origem: "painel" });
}

function dadosResponsavel(f: FormData, codigo: string, ancora: string) {
  const nome = texto(f, "nome");
  if (!nome || nome.length < 3) voltar(codigo, "erro", "Informe o nome completo.", ancora);
  const celularBruto = texto(f, "celular");
  const celular = celularBruto ? normalizarTelefone(celularBruto) : null;
  if (celularBruto && !celular) voltar(codigo, "erro", "Celular inválido: use DDD + número, ex.: 11996525783.", ancora);
  const email = texto(f, "email")?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) voltar(codigo, "erro", "E-mail inválido.", ancora);
  const estado = texto(f, "estado_civil");
  return {
    cpf: cpfOpcional(f, codigo, ancora),
    rg: texto(f, "rg"),
    nome,
    nome_social: texto(f, "nome_social"),
    nascimento: data(f, "nascimento"),
    naturalidade: texto(f, "naturalidade"),
    nacionalidade: texto(f, "nacionalidade") ?? "Brasileira",
    estado_civil: estado && ESTADOS_CIVIS.has(estado) ? estado : null,
    celular,
    email,
  };
}

function dadosVinculo(f: FormData) {
  const parentesco = String(f.get("parentesco") ?? "");
  return {
    parentesco: PARENTESCOS.has(parentesco) ? parentesco : "outro",
    parentesco_descricao: parentesco === "outro" ? texto(f, "parentesco_descricao") : null,
    financeiro: f.get("financeiro") === "on",
    acesso_app: f.get("acesso_app") === "on",
  };
}

/** Novo responsável. Se o CPF já está cadastrado (irmão já matriculado), só vincula a pessoa existente. */
export async function adicionarResponsavel(formData: FormData) {
  const { supabase } = await exigirArea("secretaria", "editar");
  const codigo = String(formData.get("codigo") ?? "");
  const dados = dadosResponsavel(formData, codigo, "responsaveis");
  const vinculo = dadosVinculo(formData);

  type Pessoa = { id: number; nome: string; cpf: string | null; celular: string | null };
  let responsavel: Pessoa | null = null;
  let reaproveitado = false;
  if (dados.cpf) {
    const { data: existente } = await supabase.from("responsaveis").select("id,nome,cpf,celular").eq("cpf", dados.cpf).maybeSingle();
    if (existente) {
      responsavel = existente as Pessoa;
      reaproveitado = true;
    }
  }
  if (!responsavel) {
    const { data: novo, error } = await supabase.from("responsaveis").insert(dados).select("id,nome,cpf,celular").single();
    if (error || !novo) {
      console.error("[cadastro] responsável", error);
      voltar(codigo, "erro", "Não foi possível cadastrar o responsável.", "responsaveis");
    }
    responsavel = novo as Pessoa;
  }
  if (vinculo.financeiro) await supabase.from("aluno_vinculos").update({ financeiro: false }).eq("aluno_codigo", codigo);
  const { error } = await supabase.from("aluno_vinculos").insert({ aluno_codigo: codigo, responsavel_id: responsavel!.id, ...vinculo });
  if (error) {
    voltar(codigo, "erro", error.code === "23505" ? "Essa pessoa já é responsável por este aluno." : "Não foi possível vincular.", "responsaveis");
  }
  await acertarAcessoApp(supabase, codigo, responsavel!, vinculo.acesso_app);
  revalidatePath(`/alunos/${codigo}`, "layout");
  voltar(
    codigo,
    "salvo",
    reaproveitado
      ? `${responsavel!.nome} já estava cadastrado (irmão): vinculado com os dados existentes. Confira e atualize abaixo se precisar.`
      : `${responsavel!.nome} cadastrado.`,
    "responsaveis",
  );
}

/** Atualiza a pessoa (vale para todos os filhos dela) e o vínculo com este aluno. */
export async function salvarResponsavel(formData: FormData) {
  const { supabase } = await exigirArea("secretaria", "editar");
  const codigo = String(formData.get("codigo") ?? "");
  const id = Number(formData.get("responsavel_id"));
  const ancora = `resp-${id}`;
  const dados = dadosResponsavel(formData, codigo, ancora);
  const vinculo = dadosVinculo(formData);

  const { data: antes } = await supabase.from("responsaveis").select("celular").eq("id", id).maybeSingle();
  const { error } = await supabase.from("responsaveis").update({ ...dados, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) voltar(codigo, "erro", error.code === "23505" ? "Esse CPF já é de outra pessoa cadastrada." : "Não foi possível salvar.", ancora);
  if (vinculo.financeiro) await supabase.from("aluno_vinculos").update({ financeiro: false }).eq("aluno_codigo", codigo).neq("responsavel_id", id);
  await supabase.from("aluno_vinculos").update(vinculo).eq("aluno_codigo", codigo).eq("responsavel_id", id);

  // Celular novo vale para o acesso ao app de todos os filhos dessa pessoa.
  const { data: filhos } = await supabase.from("aluno_vinculos").select("aluno_codigo,acesso_app").eq("responsavel_id", id);
  for (const f of filhos ?? []) {
    await acertarAcessoApp(supabase, f.aluno_codigo as string, { nome: dados.nome!, cpf: dados.cpf, celular: dados.celular }, f.acesso_app as boolean, antes?.celular as string | null);
  }
  revalidatePath(`/alunos/${codigo}`, "layout");
  voltar(codigo, "salvo", `${dados.nome} salvo.`, ancora);
}

export async function desvincularResponsavel(formData: FormData) {
  const { supabase } = await exigirArea("secretaria", "editar");
  const codigo = String(formData.get("codigo") ?? "");
  const id = Number(formData.get("responsavel_id"));
  const { data: r } = await supabase.from("responsaveis").select("nome,cpf,celular").eq("id", id).maybeSingle();
  await supabase.from("aluno_vinculos").delete().eq("aluno_codigo", codigo).eq("responsavel_id", id);
  if (r) await acertarAcessoApp(supabase, codigo, r as { nome: string; cpf: string | null; celular: string | null }, false);
  revalidatePath(`/alunos/${codigo}`, "layout");
  voltar(codigo, "salvo", `${r?.nome ?? "Responsável"} desvinculado deste aluno.`, "responsaveis");
}
