import Link from "next/link";
import { notFound } from "next/navigation";
import { BoletimImpresso } from "@/components/BoletimImpresso";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { exigirAdmin } from "@/lib/auth";
import { boletimDaTurma } from "@/lib/boletim";

export default async function BoletinsDaTurma({ params, searchParams }: PageProps<"/boletim/[turma]">) {
  const { supabase } = await exigirAdmin();
  const { turma: bruto } = await params;
  const p = await searchParams;
  const turmaId = Number(bruto);
  if (!Number.isInteger(turmaId)) notFound();
  const aluno = typeof p.aluno === "string" ? p.aluno : null;

  const boletim = await boletimDaTurma(supabase, turmaId, aluno ? [aluno] : undefined);
  if (!boletim) notFound();
  const { turma, regra, bimestres, alunos } = boletim;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link href="/boletim" className="text-sm text-verde-claro underline-offset-4 hover:underline">
          ‹ Boletins
        </Link>
        <h1 className="flex-1 font-titulo text-2xl text-verde-escuro">
          {aluno ? alunos[0]?.nome ?? "Aluno" : turma.nome}
        </h1>
        {aluno && (
          <Link href={`/boletim/${turmaId}`} className="botao-secundario">
            Turma inteira
          </Link>
        )}
        <BotaoImprimir rotulo={aluno ? "Imprimir / PDF" : `Imprimir os ${alunos.length} boletins`} />
      </div>

      {!aluno && alunos.length > 0 && (
        <nav className="mb-6 flex flex-wrap gap-1.5 print:hidden" aria-label="Alunos">
          {alunos.map((a) => (
            <Link key={a.codigo} href={`/boletim/${turmaId}?aluno=${a.codigo}`} className="rounded-full border border-borda bg-white px-2.5 py-1 text-xs hover:border-verde-claro">
              {a.numero ? `${a.numero}. ` : ""}
              {a.nome.split(" ").slice(0, 2).join(" ")}
            </Link>
          ))}
        </nav>
      )}

      {alunos.length === 0 ? (
        <p className="rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">Nenhum aluno nesta turma.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {alunos.map((a) => (
            <BoletimImpresso key={a.codigo} aluno={a} turma={turma} regra={regra} bimestres={bimestres} />
          ))}
        </div>
      )}
    </div>
  );
}
