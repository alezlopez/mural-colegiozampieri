import { diaDaSemana, somarDias } from "./datas";

export const TIPOS_EVENTO = {
  feriado: { rotulo: "Feriado", suspende: true },
  recesso: { rotulo: "Recesso / férias", suspende: true },
  sabado_letivo: { rotulo: "Sábado letivo", suspende: false },
  avaliacao: { rotulo: "Avaliação", suspende: false },
  evento: { rotulo: "Evento", suspende: false },
  reuniao: { rotulo: "Reunião", suspende: false },
  conselho: { rotulo: "Conselho de classe", suspende: false },
  outro: { rotulo: "Outro", suspende: false },
} as const;
export type TipoEvento = keyof typeof TIPOS_EVENTO;
export const ehTipoEvento = (t: string): t is TipoEvento => t in TIPOS_EVENTO;

/** LDB (Lei 9.394/96, art. 24, I): mínimo de 200 dias de efetivo trabalho escolar. */
export const MINIMO_DIAS_LETIVOS = 200;

export type EventoCalendario = {
  id: number;
  inicio: string;
  fim: string;
  tipo: TipoEvento;
  titulo: string;
  descricao: string | null;
  letivo: boolean;
  turmas: number[] | null;
  publico: boolean;
};

/**
 * Dias letivos da escola toda entre duas datas (inclusive): segunda a sexta, menos os dias que algum evento da
 * escola toda marca como "sem aula", mais os sábados letivos. Eventos só de algumas turmas não entram na conta.
 */
export function contarDiasLetivos(inicio: string, fim: string, eventos: EventoCalendario[]) {
  const daEscola = eventos.filter((e) => !e.turmas || e.turmas.length === 0);
  let total = 0;
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    const doDia = daEscola.filter((e) => e.inicio <= d && d <= e.fim);
    const dia = diaDaSemana(d);
    if (dia === 7) continue;
    if (dia === 6) {
      if (doDia.some((e) => e.tipo === "sabado_letivo" && e.letivo)) total++;
      continue;
    }
    if (!doDia.some((e) => !e.letivo)) total++;
  }
  return total;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
function pascoa(ano: number) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Feriados nacionais (Lei 662/49 e alterações; 20/11 pela Lei 14.759/23) e Sexta-feira Santa. */
export function feriadosNacionais(ano: number) {
  const p = pascoa(ano);
  const fixos: [string, string][] = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"],
    ["12-25", "Natal"],
  ];
  return [...fixos.map(([md, titulo]) => ({ data: `${ano}-${md}`, titulo })), { data: somarDias(p, -2), titulo: "Sexta-feira Santa" }].sort(
    (a, b) => a.data.localeCompare(b.data),
  );
}

/** Pontos facultativos que muitas escolas tratam como recesso; a escola decide se importa. */
export function pontosFacultativos(ano: number) {
  const p = pascoa(ano);
  return [
    { inicio: somarDias(p, -48), fim: somarDias(p, -47), titulo: "Carnaval" },
    { inicio: somarDias(p, 60), fim: somarDias(p, 60), titulo: "Corpus Christi" },
  ];
}
