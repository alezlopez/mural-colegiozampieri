"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { minutos } from "@/lib/horarios";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const aviso = (base: string, chave: "salvo" | "erro", texto: string) =>
  `${base}${base.includes("?") ? "&" : "?"}${chave}=${encodeURIComponent(texto)}`;

/** Grava o horário semanal da turma: cada célula do formulário é "h_<dia>_<aula>" = id da disciplina (ou vazio). */
export async function salvarHorario(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const turmaId = Number(formData.get("turma_id"));
  if (!Number.isInteger(turmaId)) redirect("/horarios");
  const volta = `/horarios?turma=${turmaId}`;

  const preenchidas = [...formData.entries()]
    .map(([chave, valor]) => ({ m: /^h_([1-6])_(\d{1,2})$/.exec(chave), disciplina: Number(valor) }))
    .filter((c) => c.m && Number.isInteger(c.disciplina) && c.disciplina > 0)
    .map((c) => ({ turma_id: turmaId, dia_semana: Number(c.m![1]), aula_numero: Number(c.m![2]), disciplina_id: c.disciplina }));

  if (preenchidas.length > 0) {
    const { error } = await supabase.from("turma_horario").upsert(preenchidas, { onConflict: "turma_id,dia_semana,aula_numero" });
    if (error) {
      console.error("[horários] salvar", error);
      redirect(aviso(volta, "erro", "Não foi possível salvar o horário."));
    }
  }

  // Células esvaziadas (e aulas que sobraram de um modelo de horário anterior) saem do horário.
  const { data: existentes } = await supabase.from("turma_horario").select("dia_semana,aula_numero").eq("turma_id", turmaId);
  const manter = new Set(preenchidas.map((p) => `${p.dia_semana}:${p.aula_numero}`));
  for (const e of existentes ?? []) {
    if (manter.has(`${e.dia_semana}:${e.aula_numero}`)) continue;
    await supabase.from("turma_horario").delete().eq("turma_id", turmaId).eq("dia_semana", e.dia_semana).eq("aula_numero", e.aula_numero);
  }

  redirect(aviso(volta, "salvo", "Horário salvo."));
}

export async function trocarModeloDaTurma(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const turmaId = Number(formData.get("turma_id"));
  const modeloId = Number(formData.get("modelo_id"));
  if (!Number.isInteger(turmaId) || !Number.isInteger(modeloId)) redirect("/horarios");
  const { error } = await supabase.from("turmas").update({ modelo_horario_id: modeloId }).eq("id", turmaId);
  redirect(
    error
      ? aviso(`/horarios?turma=${turmaId}`, "erro", "Não foi possível trocar o modelo.")
      : aviso(`/horarios?turma=${turmaId}`, "salvo", "Modelo de horário trocado."),
  );
}

/** Salva os horários de um modelo. Linhas em branco são removidas; as aulas são renumeradas pela hora de início. */
export async function salvarModelo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const modeloId = Number(formData.get("modelo_id"));
  const nome = String(formData.get("nome") ?? "").trim();
  const volta = "/horarios/modelos";
  if (!Number.isInteger(modeloId)) redirect(volta);
  if (!nome) redirect(aviso(volta, "erro", "Dê um nome ao modelo."));

  const inicios = formData.getAll("inicio").map(String);
  const fins = formData.getAll("fim").map(String);
  const linhas: { inicio: string; fim: string }[] = [];
  for (let i = 0; i < inicios.length; i++) {
    const [ini, fim] = [inicios[i]?.slice(0, 5) ?? "", fins[i]?.slice(0, 5) ?? ""];
    if (!ini && !fim) continue;
    if (!HORA.test(ini) || !HORA.test(fim)) redirect(aviso(volta, "erro", `${nome}: preencha início e fim de todas as aulas.`));
    if (minutos(fim) <= minutos(ini)) redirect(aviso(volta, "erro", `${nome}: a aula das ${ini} termina antes de começar.`));
    linhas.push({ inicio: ini, fim });
  }
  if (linhas.length === 0) redirect(aviso(volta, "erro", `${nome}: o modelo precisa de pelo menos uma aula.`));
  if (linhas.length > 15) redirect(aviso(volta, "erro", `${nome}: no máximo 15 aulas.`));
  linhas.sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
  for (let i = 1; i < linhas.length; i++) {
    if (minutos(linhas[i].inicio) < minutos(linhas[i - 1].fim)) {
      redirect(aviso(volta, "erro", `${nome}: a aula das ${linhas[i].inicio} começa antes da anterior terminar.`));
    }
  }

  const { error: erroNome } = await supabase.from("modelos_horario").update({ nome }).eq("id", modeloId);
  if (erroNome) redirect(aviso(volta, "erro", erroNome.code === "23505" ? "Já existe um modelo com esse nome." : "Não foi possível salvar."));
  const { error } = await supabase
    .from("modelo_horario_aulas")
    .upsert(linhas.map((l, i) => ({ modelo_id: modeloId, numero: i + 1, inicio: l.inicio, fim: l.fim })), { onConflict: "modelo_id,numero" });
  if (error) {
    console.error("[horários] modelo", error);
    redirect(aviso(volta, "erro", "Não foi possível salvar as aulas do modelo."));
  }
  await supabase.from("modelo_horario_aulas").delete().eq("modelo_id", modeloId).gt("numero", linhas.length);
  redirect(aviso(volta, "salvo", `Modelo "${nome}" salvo.`));
}

export async function criarModelo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const copiarDe = Number(formData.get("copiar_de"));
  const volta = "/horarios/modelos";
  if (!nome) redirect(aviso(volta, "erro", "Dê um nome ao novo modelo."));

  const { data: novo, error } = await supabase.from("modelos_horario").insert({ nome }).select("id").single();
  if (error || !novo) redirect(aviso(volta, "erro", error?.code === "23505" ? "Já existe um modelo com esse nome." : "Não foi possível criar."));
  if (Number.isInteger(copiarDe) && copiarDe > 0) {
    const { data: aulas } = await supabase.from("modelo_horario_aulas").select("numero,inicio,fim").eq("modelo_id", copiarDe);
    if (aulas?.length) await supabase.from("modelo_horario_aulas").insert(aulas.map((a) => ({ ...a, modelo_id: novo.id })));
  }
  redirect(aviso(volta, "salvo", `Modelo "${nome}" criado. Ajuste os horários abaixo.`));
}

export async function excluirModelo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const modeloId = Number(formData.get("modelo_id"));
  const volta = "/horarios/modelos";
  if (!Number.isInteger(modeloId)) redirect(volta);
  const { count } = await supabase.from("turmas").select("id", { count: "exact", head: true }).eq("modelo_horario_id", modeloId);
  if (count) redirect(aviso(volta, "erro", `Este modelo está em uso por ${count} turma(s). Troque o modelo delas antes de excluir.`));
  const { error } = await supabase.from("modelos_horario").delete().eq("id", modeloId);
  redirect(error ? aviso(volta, "erro", "Não foi possível excluir.") : aviso(volta, "salvo", "Modelo excluído."));
}
