"use client";

import { useActionState } from "react";
import { importar, type EstadoImportacao } from "./actions";

export function FormImportacao({ tipos }: { tipos: [string, string][] }) {
  const [estado, acao, enviando] = useActionState<EstadoImportacao, FormData>(importar, null);
  return (
    <div className="space-y-4">
      <form action={acao} className="space-y-3 rounded-xl border border-borda bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <label className="block">
            <span className="rotulo">Tipo</span>
            <select name="tipo" defaultValue={estado && "tipo" in estado ? estado.tipo : "alunos"} className="campo">
              {tipos.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="rotulo">Arquivo CSV</span>
            <input name="arquivo" type="file" accept=".csv,text/csv" required className="campo" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button name="modo" value="conferir" disabled={enviando} className="botao-secundario">
            {enviando ? "Lendo…" : "1. Conferir (não grava)"}
          </button>
          <button name="modo" value="gravar" disabled={enviando} className="botao-primario">
            2. Importar
          </button>
        </div>
        <p className="text-xs text-texto-suave">Depois de conferir, escolha o arquivo de novo e clique em Importar.</p>
      </form>

      {estado && "erro" in estado && estado.erro && !("linhas" in estado) && (
        <p role="alert" className="rounded-md border border-vinho/30 bg-vinho/5 px-3 py-2 text-sm text-vinho">
          {estado.erro}
        </p>
      )}
      {estado && "linhas" in estado && (
        <div className={`rounded-xl border p-4 text-sm ${estado.gravado && !estado.erro ? "border-verde-claro/40 bg-verde-claro/10" : "border-dourado/40 bg-dourado/10"}`}>
          <p className="font-bold text-verde-escuro">
            {estado.gravado ? (estado.erro ? "Importação interrompida" : "Importado") : "Conferência (nada foi gravado)"} · {estado.arquivo}
          </p>
          <p className="mt-1">
            {estado.linhas} linha(s) lida(s) · <strong>{estado.atualizados}</strong> {estado.tipo === "alunos" ? "aluno(s)" : "responsável(is)"}{" "}
            {estado.gravado ? "atualizado(s)" : "seriam atualizados"} ({estado.camposPreenchidos} campo(s) vazio(s) preenchido(s)) ·{" "}
            {estado.semMudanca} já completo(s)
          </p>
          {estado.erro && <p className="mt-2 font-bold text-vinho">{estado.erro}</p>}
          {estado.problemas.length > 0 && (
            <>
              <p className="mt-3 font-bold text-texto">Linhas com problema (ignoradas):</p>
              <ul className="mt-1 max-h-64 list-disc overflow-y-auto pl-5 text-xs text-texto">
                {estado.problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
