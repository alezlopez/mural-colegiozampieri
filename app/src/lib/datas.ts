const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Formatação manual: Intl com locale pt-BR não é garantido em todos os motores JS (Hermes/Android).
function doisDigitos(n: number) {
  return n.toString().padStart(2, '0');
}

export function tempoRelativo(iso: string, agora = new Date()) {
  const data = new Date(iso);
  const minutos = Math.floor((agora.getTime() - data.getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return dataCurta(iso, agora);
}

export function dataCurta(iso: string, agora = new Date()) {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MESES[d.getMonth()]}`;
  return d.getFullYear() === agora.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function dataEvento(iso: string) {
  const d = new Date(iso);
  const hora = d.getHours() === 0 && d.getMinutes() === 0 ? '' : ` · ${doisDigitos(d.getHours())}h${doisDigitos(d.getMinutes())}`;
  return {
    dia: doisDigitos(d.getDate()),
    mes: MESES[d.getMonth()].toUpperCase(),
    descricao: `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}${hora}`,
  };
}

// Datas do diário (AAAA-MM-DD, sem fuso: o dia da escola).
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Hoje no relógio do celular, como AAAA-MM-DD. */
export function hojeISO(agora = new Date()) {
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

function paraData(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

export function somarDiasISO(iso: string, dias: number) {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "ter, 2 mar" */
export function diaCurto(iso: string) {
  const d = paraData(iso);
  return `${DIAS_CURTOS[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemanaISO(iso: string) {
  return paraData(iso).getUTCDay();
}

export function nomeDoMes(iso: string) {
  const d = paraData(iso);
  return `${MESES_LONGOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
