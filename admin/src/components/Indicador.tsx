import type { Route } from "next";
import Link from "next/link";

/** Número grande com rótulo, para os resumos do acompanhamento. Com href, vira atalho para o detalhe. */
export function Indicador({ rotulo, valor, detalhe, alerta = false, href }: { rotulo: string; valor: string | number; detalhe?: string; alerta?: boolean; href?: Route }) {
  const conteudo = (
    <>
      <p className="text-[11px] font-bold tracking-wider text-texto-suave uppercase">{rotulo}</p>
      <p className={`font-titulo text-3xl ${alerta ? "text-vinho" : "text-verde-escuro"}`}>{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe}</p>}
    </>
  );
  return (
    <li className="rounded-xl border border-borda bg-white">
      {href ? (
        <Link href={href} className="block h-full rounded-xl p-3 hover:bg-creme">
          {conteudo}
        </Link>
      ) : (
        <div className="p-3">{conteudo}</div>
      )}
    </li>
  );
}
