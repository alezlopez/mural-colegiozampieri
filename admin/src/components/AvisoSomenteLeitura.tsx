"use client";

import { usePathname } from "next/navigation";
import { AREAS, areaDoCaminho, type Permissoes } from "@/lib/permissoes";

/** Faixa no topo das telas que o perfil só pode consultar (as ações de gravar recusam de qualquer forma). */
export function AvisoSomenteLeitura({ permissoes }: { permissoes: Permissoes }) {
  const area = areaDoCaminho(usePathname());
  if (!area || permissoes[area] !== "ver") return null;
  return (
    <p className="mb-5 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto print:hidden">
      Somente consulta: o seu perfil pode ver {AREAS[area].rotulo}, mas não alterar. Para mudar isso, fale com a direção.
    </p>
  );
}
