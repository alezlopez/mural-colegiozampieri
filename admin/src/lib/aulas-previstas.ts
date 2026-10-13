import { semAulaNoDia, type EventoCalendario } from "./calendario";
import { diaDaSemana, somarDias } from "./datas";
import type { SlotHorario } from "./horarios";

// Calendário de aulas: quais aulas cada turma deveria ter em cada dia, a partir de
// período letivo + horário semanal + calendário (feriados/recessos, sábados letivos).
// Função pura (sem banco), usada pelo calendário da turma, pelas pendências e pelo diário.

export type Prevista = { data: string; turma_id: number; disciplina_id: number; aula_numero: number };

/** Dia da semana cujo horário vale na data para a turma (null = sem aula pelo horário). */
export function diaDoHorario(eventos: EventoCalendario[], data: string, turmaId: number): number | null {
  const dia = diaDaSemana(data);
  if (dia === 7) return null;
  if (dia === 6) {
    const sabado = eventos.find(
      (e) =>
        e.tipo === "sabado_letivo" &&
        e.inicio <= data &&
        data <= e.fim &&
        (!e.turmas || e.turmas.length === 0 || e.turmas.includes(turmaId)),
    );
    return sabado?.segue_dia_semana ?? null;
  }
  return semAulaNoDia(eventos, data, turmaId) ? null : dia;
}

export function aulasPrevistas({
  turmas,
  slots,
  eventos,
  de,
  ate,
}: {
  turmas: number[];
  slots: SlotHorario[];
  eventos: EventoCalendario[];
  /** Período a calcular, já limitado ao ano letivo (AAAA-MM-DD, inclusive). */
  de: string;
  ate: string;
}): Prevista[] {
  const porTurmaDia = new Map<string, SlotHorario[]>();
  for (const s of slots) {
    const chave = `${s.turma_id}:${s.dia_semana}`;
    porTurmaDia.set(chave, [...(porTurmaDia.get(chave) ?? []), s]);
  }
  const previstas: Prevista[] = [];
  for (let data = de; data <= ate; data = somarDias(data, 1)) {
    for (const t of turmas) {
      const dia = diaDoHorario(eventos, data, t);
      if (!dia) continue;
      for (const s of porTurmaDia.get(`${t}:${dia}`) ?? []) {
        previstas.push({ data, turma_id: t, disciplina_id: s.disciplina_id, aula_numero: s.aula_numero });
      }
    }
  }
  return previstas;
}

export const chaveAula = (a: { data: string; turma_id: number; disciplina_id: number; aula_numero: number }) =>
  `${a.turma_id}:${a.disciplina_id}:${a.data}:${a.aula_numero}`;
