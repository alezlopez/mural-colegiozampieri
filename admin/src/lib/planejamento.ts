import { diaDaSemana, somarDias } from "./datas";

// Períodos do planejamento: semana (segunda a sábado, para cobrir sábado letivo) ou mês inteiro.

export type Periodo = "semanal" | "mensal";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function semanaDe(data: string) {
  const inicio = somarDias(data, 1 - diaDaSemana(data));
  return { inicio, fim: somarDias(inicio, 5) };
}

export function mesDe(data: string) {
  const [a, m] = data.split("-").map(Number);
  const inicio = `${data.slice(0, 7)}-01`;
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { inicio, fim };
}

export function periodoDe(tipo: Periodo, data: string) {
  return tipo === "mensal" ? mesDe(data) : semanaDe(data);
}

/** "Semana de 1 a 6 mar" · "Semana de 29 mar a 3 abr" · "Março de 2027" */
export function rotuloPeriodo(tipo: Periodo, inicio: string, fim: string) {
  const d = (s: string) => Number(s.slice(8, 10));
  const m = (s: string) => Number(s.slice(5, 7)) - 1;
  if (tipo === "mensal") return `${MESES[m(inicio)].replace(/^./, (c) => c.toUpperCase())} de ${inicio.slice(0, 4)}`;
  return m(inicio) === m(fim)
    ? `Semana de ${d(inicio)} a ${d(fim)} ${MESES_CURTOS[m(fim)]}`
    : `Semana de ${d(inicio)} ${MESES_CURTOS[m(inicio)]} a ${d(fim)} ${MESES_CURTOS[m(fim)]}`;
}

/** O planejamento cobre algum dia do período? */
export const cobre = (p: { inicio: string; fim: string }, inicio: string, fim: string) => p.inicio <= fim && p.fim >= inicio;
