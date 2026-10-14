import Link from "next/link";
import { anoEmUso } from "@/lib/ano-letivo";
import { exigirAdmin } from "@/lib/auth";
import { SEGMENTOS } from "@/lib/segmentos";

export default async function PaginaBoletins({ searchParams }: PageProps<"/boletim">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const ano = Number(p.ano) || (await anoEmUso(supabase)).ano;
  const { data: turmas } = await supabase.from("turmas").select("id,nome,segmento").eq("ano", ano).eq("ativa", true).order("nome");

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Boletins {ano}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Escolha a turma para ver os boletins na tela, imprimir ou salvar em PDF. As regras de cálculo e a publicação para as
        famílias ficam em{" "}
        <Link href="/avaliacao" className="underline">
          Avaliação e boletim
        </Link>
        .
      </p>
      <div className="mt-6 space-y-6">
        {Object.entries(SEGMENTOS).map(([seg, rotulo]) => {
          const doSeg = (turmas ?? []).filter((t) => t.segmento === seg);
          if (doSeg.length === 0) return null;
          return (
            <section key={seg}>
              <h2 className="rotulo">{rotulo}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {doSeg.map((t) => (
                  <li key={t.id}>
                    <Link href={`/boletim/${t.id}`} className="block rounded-xl border border-borda bg-white p-3 text-sm text-verde-escuro hover:border-verde-claro">
                      {t.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {(turmas ?? []).length === 0 && <p className="text-sm text-texto-suave">Nenhuma turma ativa em {ano}.</p>}
      </div>
    </div>
  );
}
