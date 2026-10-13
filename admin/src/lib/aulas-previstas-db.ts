import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveAula } from "./aulas-previstas";
import type { EventoCalendario } from "./calendario";
import type { SlotHorario } from "./horarios";
import { lerTudo } from "./ler-tudo";

export type BaseDoAno = {
  ano: number;
  inicio: string;
  fim: string;
  bimestres: { numero: number; inicio: string; fim: string }[];
  slots: SlotHorario[];
  eventos: EventoCalendario[];
};

/** Período letivo, bimestres, horário semanal e calendário do ano. null se o ano letivo não foi cadastrado. */
export async function baseDoAno(db: SupabaseClient, ano: number, turmaIds: number[]): Promise<BaseDoAno | null> {
  const { data: periodo } = await db.from("anos_letivos").select("inicio,fim").eq("ano", ano).maybeSingle();
  if (!periodo) return null;
  const [{ data: bimestres }, slots, eventos] = await Promise.all([
    db.from("bimestres").select("numero,inicio,fim").eq("ano", ano).order("numero"),
    turmaIds.length
      ? lerTudo<SlotHorario>((de, ate) =>
          db
            .from("turma_horario")
            .select("turma_id,dia_semana,aula_numero,disciplina_id")
            .in("turma_id", turmaIds)
            .order("turma_id")
            .order("dia_semana")
            .order("aula_numero")
            .range(de, ate),
        )
      : Promise.resolve([]),
    lerTudo<EventoCalendario>((de, ate) =>
      db
        .from("calendario_eventos")
        .select("id,inicio,fim,tipo,titulo,descricao,letivo,turmas,publico,segue_dia_semana")
        .lte("inicio", periodo.fim)
        .gte("fim", periodo.inicio)
        .order("id")
        .range(de, ate),
    ),
  ]);
  return {
    ano,
    inicio: periodo.inicio as string,
    fim: periodo.fim as string,
    bimestres: (bimestres ?? []) as BaseDoAno["bimestres"],
    slots,
    eventos,
  };
}

/** Aulas lançadas (com conteúdo) das turmas no período, como chaves turma:disciplina:data:aula. */
export async function aulasLancadas(db: SupabaseClient, turmaIds: number[], de: string, ate: string) {
  if (turmaIds.length === 0 || de > ate) return new Set<string>();
  const linhas = await lerTudo<{ turma_id: number; disciplina_id: number; data: string; aula_numero: number }>((ini, fim) =>
    db
      .from("aulas")
      .select("turma_id,disciplina_id,data,aula_numero")
      .in("turma_id", turmaIds)
      .gte("data", de)
      .lte("data", ate)
      .not("conteudo", "is", null)
      .order("id")
      .range(ini, fim),
  );
  return new Set(linhas.map(chaveAula));
}

export const menorData = (a: string, b: string) => (a < b ? a : b);
export const maiorData = (a: string, b: string) => (a > b ? a : b);
