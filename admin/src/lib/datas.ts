// O servidor roda em UTC; a escola está em Brasília.
const FUSO = "America/Sao_Paulo";

export function formatarDataHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Data de hoje em Brasília, no formato AAAA-MM-DD. */
export function hojeEmBrasilia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Dia da semana de uma data AAAA-MM-DD: 1 = segunda … 7 = domingo. */
export function diaDaSemana(data: string) {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** "qui., 9 de out." a partir de AAAA-MM-DD. */
export function formatarDataCurta(data: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${data}T12:00:00Z`),
  );
}

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
