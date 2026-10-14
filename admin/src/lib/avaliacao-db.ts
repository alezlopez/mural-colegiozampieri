import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegraAvaliacao } from "./avaliacao";
import { hojeEmBrasilia } from "./datas";

/** Regra de avaliação do segmento no ano (sem cadastro: 3 avaliações de mesmo peso, média 6, arredondamento da escola). */
export async function regraDoSegmento(db: SupabaseClient, ano: number, segmento: string): Promise<RegraAvaliacao> {
  const { data } = await db
    .from("avaliacao_config")
    .select("avaliacoes,media_aprovacao,arredondamento,recuperacao_bimestral,descritivo")
    .eq("ano", ano)
    .eq("segmento", segmento)
    .maybeSingle();
  if (data) return { ...data, media_aprovacao: Number(data.media_aprovacao) } as RegraAvaliacao;
  return {
    avaliacoes: [
      { chave: "mensal", nome: "Prova mensal", peso: 1 },
      { chave: "bimestral", nome: "Prova bimestral", peso: 1 },
      { chave: "avaliacao", nome: "Avaliação bimestral", peso: 1 },
    ],
    media_aprovacao: 6,
    arredondamento: "escola",
    recuperacao_bimestral: true,
    descritivo: segmento === "infantil",
  };
}

export type Bimestre = { numero: number; inicio: string; fim: string; boletim_publicado: boolean };

/** Bimestres do ano e o bimestre de hoje (fora do período: o último que já começou, ou o 1º). */
export async function bimestresDoAno(db: SupabaseClient, ano: number) {
  const { data } = await db.from("bimestres").select("numero,inicio,fim,boletim_publicado").eq("ano", ano).order("numero");
  const bimestres = (data ?? []) as Bimestre[];
  const hoje = hojeEmBrasilia();
  const atual = bimestres.find((b) => b.inicio <= hoje && hoje <= b.fim) ?? [...bimestres].reverse().find((b) => b.inicio <= hoje) ?? bimestres[0];
  return { bimestres, atual: atual?.numero ?? 1 };
}
