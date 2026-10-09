"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServico } from "@/lib/supabase/servico";

export type EstadoAcesso = { professorId?: number; senha?: string; erro?: string };

// Sem caracteres que se confundem (0/O, 1/l/I) para ditar ou copiar sem erro.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function senhaProvisoria(tamanho = 10) {
  return Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}

/** Cria o login do professor (ou gera nova senha provisória, se já tiver). A senha aparece uma única vez. */
export async function gerarAcesso(_: EstadoAcesso, formData: FormData): Promise<EstadoAcesso> {
  await exigirAdmin();
  const professorId = Number(formData.get("professor_id"));
  if (!Number.isInteger(professorId)) return { erro: "Professor inválido." };

  const db = criarClienteServico();
  const { data: professor } = await db.from("professores").select("id,nome,email,user_id").eq("id", professorId).maybeSingle();
  if (!professor) return { professorId, erro: "Professor não encontrado." };
  if (!professor.email) return { professorId, erro: "Professor sem e-mail na Mhund. Cadastre o e-mail lá e sincronize." };

  const senha = senhaProvisoria();
  if (professor.user_id) {
    const { error } = await db.auth.admin.updateUserById(professor.user_id, {
      password: senha,
      user_metadata: { trocar_senha: true },
    });
    if (error) return { professorId, erro: `Não foi possível redefinir a senha: ${error.message}` };
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: professor.email,
      password: senha,
      email_confirm: true,
      user_metadata: { trocar_senha: true, nome: professor.nome },
    });
    if (error || !data.user) {
      const jaExiste = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
      return {
        professorId,
        erro: jaExiste
          ? "Já existe um usuário com esse e-mail (ex.: alguém da equipe). Use outro e-mail para o professor."
          : `Não foi possível criar o acesso: ${error?.message}`,
      };
    }
    const { error: erroVinculo } = await db.from("professores").update({ user_id: data.user.id }).eq("id", professorId);
    if (erroVinculo) return { professorId, erro: `Acesso criado, mas não vinculado: ${erroVinculo.message}` };
  }

  revalidatePath("/professores", "layout");
  return { professorId, senha };
}

export async function alternarAtivo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const professorId = Number(formData.get("professor_id"));
  const ativo = formData.get("ativo") === "true";
  if (!Number.isInteger(professorId)) return;
  await supabase.from("professores").update({ ativo }).eq("id", professorId);
  revalidatePath("/professores", "layout");
}

// ---------------------------------------------------------------------------
// Cadastro manual. Tudo que é editado aqui passa a valer mais que a Mhund (editado_no_painel):
// a sincronização noturna não desfaz.
// ---------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function voltar(caminho: string, chave: "salvo" | "erro", msg: string): never {
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${chave}=${encodeURIComponent(msg)}`);
}

function dadosProfessor(formData: FormData, caminho: string) {
  const nome = String(formData.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  if (nome.length < 3 || nome.length > 120) voltar(caminho, "erro", "Informe o nome completo do professor.");
  if (email && !EMAIL.test(email)) voltar(caminho, "erro", "E-mail inválido.");
  return { nome, email };
}

export async function criarProfessor(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const { nome, email } = dadosProfessor(formData, "/professores");
  const { data, error } = await supabase
    .from("professores")
    .insert({ nome, email, ativo: true, editado_no_painel: true })
    .select("id")
    .single();
  if (error || !data) {
    voltar("/professores", "erro", error?.code === "23505" ? "Já existe um professor com esse e-mail." : "Não foi possível cadastrar.");
  }
  voltar(`/professores/${data.id}`, "salvo", "Professor cadastrado. Atribua as turmas e disciplinas abaixo.");
}

export async function salvarProfessor(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("professor_id"));
  if (!Number.isInteger(id)) redirect("/professores");
  const caminho = `/professores/${id}`;
  const { nome, email } = dadosProfessor(formData, caminho);

  const { data: atual } = await supabase.from("professores").select("email,user_id").eq("id", id).maybeSingle();
  if (!atual) voltar("/professores", "erro", "Professor não encontrado.");
  // Quem já tem acesso entra com o e-mail: o login muda junto.
  if (atual.user_id && email !== atual.email) {
    if (!email) voltar(caminho, "erro", "Este professor já tem acesso ao diário; o e-mail não pode ficar vazio.");
    const { error } = await criarClienteServico().auth.admin.updateUserById(atual.user_id, { email, email_confirm: true });
    if (error) voltar(caminho, "erro", `Não foi possível trocar o e-mail do login: ${error.message}`);
  }
  const { error } = await supabase.from("professores").update({ nome, email, editado_no_painel: true }).eq("id", id);
  if (error) voltar(caminho, "erro", error.code === "23505" ? "Outro professor já usa esse e-mail." : "Não foi possível salvar.");
  revalidatePath("/professores", "layout");
  voltar(caminho, "salvo", "Dados do professor salvos.");
}

/** Exclusão definitiva só para quem nunca lançou aula; os demais são inativados (o histórico fica). */
export async function excluirProfessor(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = Number(formData.get("professor_id"));
  if (!Number.isInteger(id)) redirect("/professores");
  const { data: prof } = await supabase.from("professores").select("mhund_id,user_id").eq("id", id).maybeSingle();
  if (!prof) voltar("/professores", "erro", "Professor não encontrado.");
  if (prof.mhund_id) voltar(`/professores/${id}`, "erro", "Professor da Mhund volta na próxima sincronização: use Inativar.");
  const { count } = await supabase.from("aulas").select("id", { count: "exact", head: true }).eq("professor_id", id);
  if (count) voltar(`/professores/${id}`, "erro", "Este professor já lançou aulas: use Inativar para manter o histórico.");
  const { error } = await supabase.from("professores").delete().eq("id", id);
  if (error) voltar(`/professores/${id}`, "erro", "Não foi possível excluir.");
  if (prof.user_id) await criarClienteServico().auth.admin.deleteUser(prof.user_id);
  revalidatePath("/professores", "layout");
  voltar("/professores", "salvo", "Professor excluído.");
}

/** Atribui ao professor a disciplina numa turma. Se outro professor dava essa disciplina lá, é substituído. */
export async function atribuirVinculo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const professorId = Number(formData.get("professor_id"));
  const turmaIds = formData.getAll("turma_id").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const disciplinaId = Number(formData.get("disciplina_id"));
  if (!Number.isInteger(professorId)) redirect("/professores");
  const caminho = `/professores/${professorId}`;
  if (turmaIds.length === 0 || !Number.isInteger(disciplinaId) || disciplinaId <= 0) {
    voltar(caminho, "erro", "Escolha a disciplina e ao menos uma turma.");
  }

  const { data: anteriores } = await supabase
    .from("turma_disciplinas")
    .select("turma_id,professor_id,professores(nome)")
    .eq("disciplina_id", disciplinaId)
    .in("turma_id", turmaIds)
    .neq("professor_id", professorId)
    .not("professor_id", "is", null)
    .overrideTypes<{ turma_id: number; professor_id: number; professores: { nome: string } | null }[], { merge: false }>();

  const { error } = await supabase.from("turma_disciplinas").upsert(
    turmaIds.map((t) => ({ turma_id: t, disciplina_id: disciplinaId, professor_id: professorId, editado_no_painel: true })),
    { onConflict: "turma_id,disciplina_id" },
  );
  if (error) {
    console.error("[professores] atribuir", error);
    voltar(caminho, "erro", "Não foi possível atribuir.");
  }
  for (const t of turmaIds) await supabase.from("vinculos_removidos").delete().eq("turma_id", t).eq("disciplina_id", disciplinaId);
  revalidatePath("/professores", "layout");
  const substituidos = [...new Set((anteriores ?? []).map((a) => a.professores?.nome.split(" ")[0]).filter(Boolean))];
  voltar(
    caminho,
    "salvo",
    `Atribuído em ${turmaIds.length} turma(s).${substituidos.length ? ` Substituiu: ${substituidos.join(", ")}.` : ""}`,
  );
}

/** Tira a disciplina da turma (some do diário e do horário); a sincronização não a traz de volta. */
export async function removerVinculo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const professorId = Number(formData.get("professor_id"));
  const turmaId = Number(formData.get("turma_id"));
  const disciplinaId = Number(formData.get("disciplina_id"));
  const caminho = Number.isInteger(professorId) ? `/professores/${professorId}` : "/professores";
  if (!Number.isInteger(turmaId) || !Number.isInteger(disciplinaId)) voltar(caminho, "erro", "Vínculo inválido.");
  const modo = formData.get("modo") === "sem_professor" ? "sem_professor" : "remover";

  if (modo === "sem_professor") {
    // A disciplina continua na turma, só sem professor (ex.: aguardando contratação).
    const { error } = await supabase
      .from("turma_disciplinas")
      .update({ professor_id: null, editado_no_painel: true })
      .eq("turma_id", turmaId)
      .eq("disciplina_id", disciplinaId);
    if (error) voltar(caminho, "erro", "Não foi possível tirar o professor.");
  } else {
    await supabase.from("vinculos_removidos").upsert({ turma_id: turmaId, disciplina_id: disciplinaId }, { onConflict: "turma_id,disciplina_id" });
    const { error } = await supabase.from("turma_disciplinas").delete().eq("turma_id", turmaId).eq("disciplina_id", disciplinaId);
    if (error) voltar(caminho, "erro", "Não foi possível remover.");
    await supabase.from("turma_horario").delete().eq("turma_id", turmaId).eq("disciplina_id", disciplinaId);
  }
  revalidatePath("/professores", "layout");
  voltar(caminho, "salvo", modo === "sem_professor" ? "Professor retirado da disciplina nessa turma." : "Disciplina retirada da turma.");
}
