import { exigirAdmin } from "@/lib/auth";
import { relatorioRematricula } from "@/lib/rematricula";
import { exibirTelefone } from "@/lib/telefone";

// Planilha (CSV para Excel em português: separador ";" e BOM para os acentos) das listas da rematrícula.
export async function GET(request: Request) {
  const { supabase } = await exigirAdmin();
  const url = new URL(request.url);
  const base = Number(url.searchParams.get("base"));
  if (!Number.isInteger(base) || base < 2020 || base > 2100) return new Response("Ano inválido", { status: 400 });
  const lista = url.searchParams.get("lista") ?? "nao";

  const r = await relatorioRematricula(supabase, base, base + 1);
  const alunos = lista === "novos" ? r.novos : lista === "concluintes" ? r.concluintes : r.naoRematriculados;
  const celula = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [
    ["Código", "Aluno", `Turma ${base}`, `Turma ${base + 1}`, `Situação ${base + 1}`, "Responsável financeiro", "Celular"],
    ...alunos.map((a) => [a.codigo, a.nome, a.turmaBase, a.turmaAlvo, a.situacaoAlvo, a.responsavel, a.telefone ? exibirTelefone(a.telefone) : null]),
  ].map((l) => l.map(celula).join(";"));

  return new Response(`﻿${linhas.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rematricula-${base}-${base + 1}-${lista}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
