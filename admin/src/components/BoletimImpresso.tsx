import Image from "next/image";
import { formatarNota, type RegraAvaliacao } from "@/lib/avaliacao";
import type { Bimestre } from "@/lib/avaliacao-db";
import type { BoletimAluno } from "@/lib/boletim";

type Props = {
  aluno: BoletimAluno;
  turma: { nome: string; ano: number };
  regra: RegraAvaliacao;
  bimestres: Bimestre[];
};

/** Boletim de um aluno, pronto para tela e impressão (uma página por aluno). */
export function BoletimImpresso({ aluno, turma, regra, bimestres }: Props) {
  const corDaNota = (n: number | null) => (n === null ? "text-texto-suave" : n < regra.media_aprovacao ? "font-bold text-vinho" : "text-texto");
  const publicado = (b: number) => bimestres.find((x) => x.numero === b)?.boletim_publicado;

  return (
    <article className="break-after-page rounded-xl border border-borda bg-white p-5 print:rounded-none print:border-0 print:p-0">
      <header className="flex items-center gap-3 border-b border-borda pb-3">
        <Image src="/brasao.png" alt="" width={34} height={42} />
        <div className="flex-1">
          <p className="font-titulo text-lg leading-tight text-verde-escuro">Colégio Zampieri</p>
          <p className="text-[11px] font-bold tracking-[0.18em] text-dourado">BOLETIM ESCOLAR {turma.ano}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-texto">{aluno.nome}</p>
          <p className="text-xs text-texto-suave">
            {turma.nome} · código {aluno.codigo}
            {aluno.numero ? ` · nº ${aluno.numero}` : ""}
          </p>
        </div>
      </header>

      {regra.descritivo ? (
        <div className="mt-4 space-y-4">
          {aluno.linhas.map((l) => (
            <section key={l.disciplina_id}>
              <h3 className="font-bold text-verde-escuro">{l.disciplina}</h3>
              {l.bimestres.map((b, i) =>
                b.parecer ? (
                  <div key={i} className="mt-1">
                    <p className="text-[11px] font-bold tracking-wider text-texto-suave uppercase">{i + 1}º bimestre</p>
                    <p className="whitespace-pre-line text-sm text-texto">{b.parecer}</p>
                  </div>
                ) : null,
              )}
              {!l.bimestres.some((b) => b.parecer) && <p className="text-sm text-texto-suave">Sem parecer lançado.</p>}
            </section>
          ))}
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-creme text-xs text-texto-suave print:bg-transparent">
              <th className="border border-borda px-2 py-1.5 text-left">Disciplina</th>
              {[1, 2, 3, 4].map((b) => (
                <th key={b} className="border border-borda px-1 py-1.5 text-center" colSpan={2}>
                  {b}º bim.
                </th>
              ))}
              <th className="border border-borda px-1 py-1.5 text-center">Média final</th>
              <th className="border border-borda px-1 py-1.5 text-center">Faltas</th>
            </tr>
            <tr className="text-[10px] text-texto-suave">
              <th className="border border-borda" />
              {[1, 2, 3, 4].map((b) => [
                <th key={`m${b}`} className="border border-borda px-1 py-0.5 font-normal">
                  Média
                </th>,
                <th key={`f${b}`} className="border border-borda px-1 py-0.5 font-normal">
                  F
                </th>,
              ])}
              <th className="border border-borda" />
              <th className="border border-borda" />
            </tr>
          </thead>
          <tbody>
            {aluno.linhas.map((l) => (
              <tr key={l.disciplina_id}>
                <td className="border border-borda px-2 py-1.5">{l.disciplina}</td>
                {l.bimestres.map((b, i) => [
                  <td key={`m${i}`} className={`border border-borda px-1 py-1.5 text-center ${corDaNota(b.resultado.final)}`}>
                    {formatarNota(b.resultado.final)}
                    {b.resultado.emRecuperacao && b.resultado.recuperacao !== null && <sup className="text-[9px] text-texto-suave"> R</sup>}
                  </td>,
                  <td key={`f${i}`} className="border border-borda px-1 py-1.5 text-center text-texto-suave">
                    {b.faltas || ""}
                  </td>,
                ])}
                <td className={`border border-borda px-1 py-1.5 text-center ${corDaNota(l.anual.media)}`}>{formatarNota(l.anual.media)}</td>
                <td className="border border-borda px-1 py-1.5 text-center">{l.faltasNoAno}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="mt-3 text-[11px] leading-snug text-texto-suave">
        {!regra.descritivo &&
          `Média para aprovação: ${formatarNota(regra.media_aprovacao)}. R = média após recuperação bimestral. F = faltas no bimestre. `}
        {[1, 2, 3, 4].some((b) => !publicado(b)) &&
          `Bimestres ainda não publicados às famílias: ${[1, 2, 3, 4].filter((b) => !publicado(b)).map((b) => `${b}º`).join(", ")}.`}
      </footer>
    </article>
  );
}
