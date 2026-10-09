"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { ehTipoEvento, feriadosNacionais, pontosFacultativos, TIPOS_EVENTO } from "@/lib/calendario";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function voltar(ano: number, chave: "salvo" | "erro", msg: string, extra = ""): never {
  redirect(`/calendario?ano=${ano}${extra}&${chave}=${encodeURIComponent(msg)}`);
}

function anoDoForm(formData: FormData) {
  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) redirect("/calendario");
  return ano;
}

export async function salvarAnoLetivo(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const ano = anoDoForm(formData);
  const inicio = texto(formData, "inicio");
  const fim = texto(formData, "fim");
  if (!DATA.test(inicio) || !DATA.test(fim) || fim <= inicio) voltar(ano, "erro", "Informe o início e o fim do ano letivo.");

  const bimestres = [1, 2, 3, 4].map((n) => ({
    ano,
    numero: n,
    inicio: texto(formData, `b${n}_inicio`),
    fim: texto(formData, `b${n}_fim`),
  }));
  for (const b of bimestres) {
    if (!DATA.test(b.inicio) || !DATA.test(b.fim)) voltar(ano, "erro", `Preencha as datas do ${b.numero}º bimestre.`);
    if (b.fim < b.inicio) voltar(ano, "erro", `O ${b.numero}º bimestre termina antes de começar.`);
    if (b.inicio < inicio || b.fim > fim) voltar(ano, "erro", `O ${b.numero}º bimestre está fora do ano letivo.`);
    if (b.numero > 1 && b.inicio <= bimestres[b.numero - 2].fim) {
      voltar(ano, "erro", `O ${b.numero}º bimestre começa antes do ${b.numero - 1}º terminar.`);
    }
  }

  const ativo = formData.get("ativo") === "on";
  const { error } = await supabase.from("anos_letivos").upsert({ ano, inicio, fim, ativo }, { onConflict: "ano" });
  if (error) {
    console.error("[calendário] ano letivo", error);
    voltar(ano, "erro", "Não foi possível salvar o ano letivo.");
  }
  if (ativo) await supabase.from("anos_letivos").update({ ativo: false }).neq("ano", ano);
  const { error: erroBim } = await supabase.from("bimestres").upsert(bimestres, { onConflict: "ano,numero" });
  if (erroBim) {
    console.error("[calendário] bimestres", erroBim);
    voltar(ano, "erro", "Ano letivo salvo, mas os bimestres não. Tente de novo.");
  }
  voltar(ano, "salvo", `Ano letivo de ${ano} salvo.`);
}

export async function salvarEvento(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const ano = anoDoForm(formData);
  const id = Number(formData.get("id")) || null;
  const tipo = texto(formData, "tipo");
  const titulo = texto(formData, "titulo");
  const inicio = texto(formData, "inicio");
  const fim = texto(formData, "fim") || inicio;
  const descricao = texto(formData, "descricao") || null;
  const editar = id ? `&editar=${id}` : "";

  if (!ehTipoEvento(tipo)) voltar(ano, "erro", "Escolha o tipo do evento.", editar);
  if (!titulo || titulo.length > 120) voltar(ano, "erro", "Dê um título ao evento (até 120 letras).", editar);
  if (!DATA.test(inicio) || !DATA.test(fim) || fim < inicio) voltar(ano, "erro", "Confira as datas do evento.", editar);
  if (descricao && descricao.length > 2000) voltar(ano, "erro", "Descrição muito longa.", editar);

  const turmas =
    formData.get("escopo") === "turmas"
      ? formData
          .getAll("turmas")
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
  if (formData.get("escopo") === "turmas" && turmas.length === 0) voltar(ano, "erro", "Marque ao menos uma turma.", editar);

  const linha = {
    ano,
    tipo,
    titulo,
    inicio,
    fim,
    descricao,
    // Sábado letivo sempre conta como dia de aula; nos demais, a secretaria decide se suspende as aulas.
    letivo: tipo === "sabado_letivo" ? true : formData.get("sem_aula") !== "on",
    publico: formData.get("publico") === "on",
    turmas: turmas.length > 0 ? turmas : null,
  };
  const { error } = id
    ? await supabase.from("calendario_eventos").update(linha).eq("id", id)
    : await supabase.from("calendario_eventos").insert(linha);
  if (error) {
    console.error("[calendário] evento", error);
    voltar(ano, "erro", "Não foi possível salvar o evento.", editar);
  }
  voltar(ano, "salvo", id ? "Evento atualizado." : "Evento incluído no calendário.");
}

export async function excluirEvento(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const ano = anoDoForm(formData);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) voltar(ano, "erro", "Evento inválido.");
  const { error } = await supabase.from("calendario_eventos").delete().eq("id", id);
  voltar(ano, error ? "erro" : "salvo", error ? "Não foi possível excluir." : "Evento excluído.");
}

/** Inclui os feriados nacionais do ano (e, se marcados, Carnaval e Corpus Christi como recesso). Não duplica. */
export async function importarFeriados(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const ano = anoDoForm(formData);
  const candidatos = [
    ...feriadosNacionais(ano).map((f) => ({ tipo: "feriado" as const, titulo: f.titulo, inicio: f.data, fim: f.data })),
    ...pontosFacultativos(ano)
      .filter((p) => formData.get(p.titulo === "Carnaval" ? "carnaval" : "corpus") === "on")
      .map((p) => ({ tipo: "recesso" as const, titulo: p.titulo, inicio: p.inicio, fim: p.fim })),
  ];
  const { data: existentes } = await supabase.from("calendario_eventos").select("inicio,titulo").eq("ano", ano);
  const ja = new Set((existentes ?? []).map((e) => `${e.inicio}|${e.titulo}`));
  const novos = candidatos
    .filter((c) => !ja.has(`${c.inicio}|${c.titulo}`))
    .map((c) => ({ ...c, ano, letivo: !TIPOS_EVENTO[c.tipo].suspende, publico: true, turmas: null }));
  if (novos.length === 0) voltar(ano, "salvo", "Os feriados já estavam no calendário.");
  const { error } = await supabase.from("calendario_eventos").insert(novos);
  if (error) {
    console.error("[calendário] feriados", error);
    voltar(ano, "erro", "Não foi possível importar os feriados.");
  }
  voltar(ano, "salvo", `${novos.length} data(s) incluída(s). Inclua também os feriados municipais e as férias.`);
}
