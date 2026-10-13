import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ano letivo em uso: o marcado como "em uso" no calendário; sem marcação, o maior ano com turma ativa.
 * Telas do dia a dia (diário, horários) mostram só as turmas desse ano.
 */
export async function anoEmUso(db: SupabaseClient) {
  const { data: marcado } = await db.from("anos_letivos").select("ano,inicio,fim").eq("ativo", true).maybeSingle();
  if (marcado) return { ano: marcado.ano as number, inicio: marcado.inicio as string, fim: marcado.fim as string };
  const { data: turma } = await db.from("turmas").select("ano").eq("ativa", true).order("ano", { ascending: false }).limit(1).maybeSingle();
  const ano = (turma?.ano as number | undefined) ?? new Date().getFullYear();
  const { data: periodo } = await db.from("anos_letivos").select("inicio,fim").eq("ano", ano).maybeSingle();
  return { ano, inicio: (periodo?.inicio as string | undefined) ?? null, fim: (periodo?.fim as string | undefined) ?? null };
}
