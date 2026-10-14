import type { Route } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { AREAS, PERFIS, inicioDe, type Area } from "@/lib/permissoes";

export default async function PaginaSemPermissao({ searchParams }: PageProps<"/sem-permissao">) {
  const { perfil, permissoes } = await exigirAdmin();
  const inicio = inicioDe(permissoes);
  const p = await searchParams;
  const area = typeof p.area === "string" && p.area in AREAS ? AREAS[p.area as Area].rotulo : null;
  const editar = p.nivel === "editar";

  return (
    <div className="max-w-xl">
      <h1 className="font-titulo text-3xl text-verde-escuro">Sem permissão</h1>
      <p className="mt-3 text-sm text-texto">
        O perfil <strong>{PERFIS[perfil]}</strong> {editar ? "pode consultar, mas não alterar" : "não tem acesso a"}{" "}
        {area ? <strong>{area}</strong> : "esta área"}.
      </p>
      <p className="mt-2 text-sm text-texto-suave">
        Se precisar, peça à direção para ajustar as permissões do seu perfil em Equipe.
      </p>
      {inicio && (
        <Link href={inicio as Route} className="botao-secundario mt-6 inline-block">
          Voltar ao início
        </Link>
      )}
    </div>
  );
}
