"use server";

import { revalidatePath } from "next/cache";
import { exigirArea } from "@/lib/auth";
import { importarCsv, MODELOS, type ResultadoImportacao, type TipoImportacao } from "@/lib/importacao-csv";

export type EstadoImportacao = (ResultadoImportacao & { tipo: TipoImportacao; arquivo: string }) | { erro: string } | null;

const LIMITE = 900 * 1024; // abaixo do limite de 1 MB das ações do servidor

export async function importar(_: EstadoImportacao, formData: FormData): Promise<EstadoImportacao> {
  const { supabase } = await exigirArea("secretaria", "editar");
  const tipo = String(formData.get("tipo") ?? "");
  const arquivo = formData.get("arquivo");
  const gravar = formData.get("modo") === "gravar";
  if (!(tipo in MODELOS)) return { erro: "Escolha o tipo de arquivo." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo CSV." };
  if (arquivo.size > LIMITE) return { erro: "Arquivo grande demais (máx. 900 KB). Divida em partes." };
  const r = await importarCsv(supabase, tipo as TipoImportacao, await arquivo.arrayBuffer(), gravar);
  if (gravar && !r.erro) revalidatePath("/alunos", "layout");
  return { ...r, tipo: tipo as TipoImportacao, arquivo: arquivo.name };
}
