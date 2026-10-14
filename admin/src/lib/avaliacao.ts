// Cálculo de médias (regras configuradas por ano e segmento em avaliacao_config).
// Função pura, sem banco: usada pelo diário do professor, pelo boletim do painel e (cópia em app/src/lib) pelo app.
//
// Regras da escola (informadas em 09/10/2026):
// - média do bimestre = média ponderada das avaliações, com o arredondamento da escola;
// - abaixo da média de aprovação → recuperação bimestral; se a nota da recuperação for maior, ela substitui;
// - média final = média das 4 médias bimestrais, com o mesmo arredondamento.

export type Avaliacao = { chave: string; nome: string; peso: number };
export type RegraAvaliacao = {
  avaliacoes: Avaliacao[];
  media_aprovacao: number;
  arredondamento: "escola" | "nenhum";
  recuperacao_bimestral: boolean;
  descritivo: boolean;
};

export const CHAVE_RECUPERACAO = "rec";

/**
 * Arredondamento da escola, pela parte decimal: até 0,25 → 0; acima de 0,25 até 0,59 → 0,5; de 0,60 em diante → 1.
 * Ex.: 6,25 → 6,0 · 6,3 → 6,5 · 6,6 → 7,0. Sem arredondamento, só 2 casas.
 */
export function arredondar(valor: number, regra: Pick<RegraAvaliacao, "arredondamento">) {
  const centavos = Math.round(valor * 100);
  if (regra.arredondamento === "nenhum") return centavos / 100;
  const inteiro = Math.floor(centavos / 100);
  const resto = centavos - inteiro * 100;
  const r = resto <= 25 ? inteiro : resto <= 59 ? inteiro + 0.5 : inteiro + 1;
  return Math.min(10, r);
}

export type ResultadoBimestre = {
  /** Média das avaliações (arredondada), só quando todas foram lançadas. */
  media: number | null;
  /** Média parcial com as avaliações já lançadas (para o professor acompanhar). */
  parcial: number | null;
  lancadas: number;
  /** Ficou abaixo da média e há recuperação bimestral. */
  emRecuperacao: boolean;
  recuperacao: number | null;
  /** Média que vale no bimestre: a recuperação substitui se for maior. */
  final: number | null;
};

export function resultadoBimestre(notas: Partial<Record<string, number>>, regra: RegraAvaliacao): ResultadoBimestre {
  const lancadas = regra.avaliacoes.filter((a) => typeof notas[a.chave] === "number");
  const pesoTotal = (lista: Avaliacao[]) => lista.reduce((s, a) => s + (a.peso || 1), 0);
  const ponderada = (lista: Avaliacao[]) =>
    lista.length ? lista.reduce((s, a) => s + (notas[a.chave] as number) * (a.peso || 1), 0) / pesoTotal(lista) : null;

  const completa = regra.avaliacoes.length > 0 && lancadas.length === regra.avaliacoes.length;
  const brutaParcial = ponderada(lancadas);
  const media = completa && brutaParcial !== null ? arredondar(brutaParcial, regra) : null;
  const emRecuperacao = regra.recuperacao_bimestral && media !== null && media < regra.media_aprovacao;
  const rec = typeof notas[CHAVE_RECUPERACAO] === "number" ? (notas[CHAVE_RECUPERACAO] as number) : null;
  const final = media === null ? null : emRecuperacao && rec !== null && rec > media ? arredondar(rec, regra) : media;

  return {
    media,
    parcial: brutaParcial === null ? null : arredondar(brutaParcial, regra),
    lancadas: lancadas.length,
    emRecuperacao,
    recuperacao: rec,
    final,
  };
}

/** Média final do ano: média das 4 médias bimestrais (só com os 4 bimestres fechados). */
export function mediaAnual(finaisDosBimestres: (number | null)[], regra: RegraAvaliacao) {
  const validas = finaisDosBimestres.filter((n): n is number => typeof n === "number");
  if (validas.length < 4) return { media: null, parcial: validas.length ? arredondar(validas.reduce((s, n) => s + n, 0) / validas.length, regra) : null };
  return { media: arredondar(validas.reduce((s, n) => s + n, 0) / 4, regra), parcial: null };
}

/** "6,5" */
export const formatarNota = (n: number | null | undefined) => (typeof n === "number" ? n.toFixed(1).replace(".", ",") : "—");

/** Lê "7,5" ou "7.5"; null se vazio; NaN se inválido. */
export function lerNota(texto: string) {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 10 && /^\d{1,2}(\.\d{1,2})?$/.test(t) ? n : Number.NaN;
}
