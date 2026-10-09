"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GRUPOS = [
  {
    titulo: "Comunicação",
    itens: [
      { href: "/", rotulo: "Publicações" },
      { href: "/fotos", rotulo: "Fotos dos alunos", contador: "fotos" as const },
    ],
  },
  {
    titulo: "Pedagógico",
    itens: [
      { href: "/turmas", rotulo: "Turmas" },
      { href: "/disciplinas", rotulo: "Disciplinas" },
      { href: "/professores", rotulo: "Professores" },
      { href: "/horarios", rotulo: "Horários" },
      { href: "/calendario", rotulo: "Calendário" },
    ],
  },
];

// "/" só fica ativo nele mesmo e nas telas de publicação; os demais valem para as subpáginas.
function ativo(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/posts");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Itens({ fotosPendentes, aoNavegar }: { fotosPendentes: number; aoNavegar?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1.5 px-3 text-[11px] font-bold tracking-[0.18em] text-dourado uppercase">{g.titulo}</p>
          <ul className="space-y-0.5">
            {g.itens.map((i) => {
              const marcado = ativo(pathname, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={aoNavegar}
                    aria-current={marcado ? "page" : undefined}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                      marcado ? "bg-verde-escuro font-bold text-white" : "text-texto hover:bg-creme"
                    }`}
                  >
                    {i.rotulo}
                    {i.contador === "fotos" && fotosPendentes > 0 && (
                      <span className="rounded-full bg-dourado px-1.5 text-[11px] font-bold text-verde-escuro">{fotosPendentes}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Menu do computador: coluna fixa à esquerda. */
export function MenuLateral({ fotosPendentes }: { fotosPendentes: number }) {
  return (
    <nav aria-label="Menu do painel" className="sticky top-6">
      <Itens fotosPendentes={fotosPendentes} />
    </nav>
  );
}

/** Menu do celular: botão no cabeçalho que abre a mesma lista. */
export function MenuCelular({ fotosPendentes }: { fotosPendentes: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex items-center gap-1.5 rounded-md border border-creme/30 px-3 py-1.5 text-sm text-creme hover:text-white"
      >
        {aberto ? "Fechar" : "Menu"}
        {!aberto && fotosPendentes > 0 && <span className="h-2 w-2 rounded-full bg-dourado" />}
      </button>
      {aberto && (
        <nav aria-label="Menu do painel" className="absolute inset-x-0 top-full z-20 border-b border-borda bg-branco-quente px-4 py-4 shadow-lg">
          <Itens fotosPendentes={fotosPendentes} aoNavegar={() => setAberto(false)} />
        </nav>
      )}
    </div>
  );
}
