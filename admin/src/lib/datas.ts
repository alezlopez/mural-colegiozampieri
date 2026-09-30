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
