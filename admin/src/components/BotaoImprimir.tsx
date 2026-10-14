"use client";

/** Abre a impressão do navegador (dá para "Salvar como PDF"). */
export function BotaoImprimir({ rotulo = "Imprimir / salvar PDF" }: { rotulo?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="botao-primario print:hidden">
      {rotulo}
    </button>
  );
}
