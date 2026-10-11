import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/datas";
import { relatorioRematricula, type AlunoRematricula } from "@/lib/rematricula";
import { exibirTelefone } from "@/lib/telefone";

const pct = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 1000) / 10}%` : "—");

export default async function PaginaRematricula({ searchParams }: PageProps<"/rematricula">) {
  const { supabase } = await exigirAdmin();
  const p = await searchParams;
  const base = Number(p.base) || Number(hojeEmBrasilia().slice(0, 4));
  const alvo = base + 1;
  const r = await relatorioRematricula(supabase, base, alvo);

  const elegiveis = r.cursandoBase - r.concluintes.length; // quem poderia voltar
  const semDadosAlvo = r.matriculadosAlvo === 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-titulo text-3xl text-verde-escuro">
            Rematrícula {base} → {alvo}
          </h1>
          <p className="mt-1 text-sm text-texto-suave">
            Compara quem cursava {base} com as matrículas de {alvo} vindas da Mhund. Concluintes (turma de conclusão)
            não contam como evasão.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Ano">
          <Link href={`/rematricula?base=${base - 1}`} className="botao-secundario !px-3">
            ‹ {base - 1}→{base}
          </Link>
          <Link href={`/rematricula?base=${base + 1}`} className="botao-secundario !px-3">
            {base + 1}→{base + 2} ›
          </Link>
        </nav>
      </div>

      {semDadosAlvo && (
        <p className="mb-6 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
          Ainda não há matrículas de {alvo} no sistema. Elas chegam pela sincronização com a Mhund para {alvo}.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Numero rotulo={`Cursando ${base}`} valor={r.cursandoBase} />
        <Numero rotulo="Rematriculados" valor={r.rematriculados.length} detalhe={pct(r.rematriculados.length, elegiveis)} cor="text-verde-claro" />
        <Numero rotulo="Não rematriculados" valor={r.naoRematriculados.length} detalhe={pct(r.naoRematriculados.length, elegiveis)} cor="text-vinho" />
        <Numero rotulo="Concluintes" valor={r.concluintes.length} />
        <Numero rotulo={`Novos em ${alvo}`} valor={r.novos.length} />
        <Numero rotulo={`Total ${alvo}`} valor={r.matriculadosAlvo} />
      </ul>

      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <h2 className="flex-1 font-titulo text-xl text-verde-escuro">Não rematriculados ({r.naoRematriculados.length})</h2>
          {r.naoRematriculados.length > 0 && (
            <a href={`/rematricula/csv?base=${base}&lista=nao`} className="botao-secundario !py-1.5">
              Baixar planilha
            </a>
          )}
        </div>
        <p className="mb-3 text-xs text-texto-suave">
          Cursavam {base} fora da turma de conclusão e não têm matrícula ativa em {alvo}. Lista para a secretaria contatar.
        </p>
        <TabelaAlunos alunos={r.naoRematriculados} mostrarAlvo />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Por turma de {base}</h2>
          <div className="overflow-x-auto rounded-xl border border-borda bg-white">
            <table className="w-full text-sm">
              <thead className="bg-creme text-left text-xs text-texto-suave">
                <tr>
                  <th className="px-3 py-2">Turma</th>
                  <th className="px-2 py-2 text-right">Alunos</th>
                  <th className="px-2 py-2 text-right">Voltaram</th>
                  <th className="px-3 py-2 text-right">Não voltaram</th>
                </tr>
              </thead>
              <tbody>
                {r.porTurmaBase.map((t) => (
                  <tr key={t.turma} className="border-t border-borda">
                    <td className="px-3 py-1.5">
                      {t.turma}
                      {t.ultimaSerie && <span className="ml-1 text-[11px] text-texto-suave">(conclusão)</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{t.total}</td>
                    <td className="px-2 py-1.5 text-right">{t.voltaram}</td>
                    <td className={`px-3 py-1.5 text-right ${t.ultimaSerie ? "text-texto-suave" : t.naoVoltaram ? "font-bold text-vinho" : ""}`}>
                      {t.naoVoltaram} {!t.ultimaSerie && <span className="text-xs font-normal">({pct(t.naoVoltaram, t.total)})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Turmas de {alvo}</h2>
          <div className="overflow-x-auto rounded-xl border border-borda bg-white">
            <table className="w-full text-sm">
              <thead className="bg-creme text-left text-xs text-texto-suave">
                <tr>
                  <th className="px-3 py-2">Turma</th>
                  <th className="px-2 py-2 text-right">Alunos</th>
                  <th className="px-2 py-2 text-right">Veteranos</th>
                  <th className="px-3 py-2 text-right">Novos</th>
                </tr>
              </thead>
              <tbody>
                {r.porTurmaAlvo.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-texto-suave">
                      Sem matrículas de {alvo}.
                    </td>
                  </tr>
                )}
                {r.porTurmaAlvo.map((t) => (
                  <tr key={t.turma} className="border-t border-borda">
                    <td className="px-3 py-1.5">{t.turma}</td>
                    <td className="px-2 py-1.5 text-right">{t.total}</td>
                    <td className="px-2 py-1.5 text-right">{t.veteranos}</td>
                    <td className="px-3 py-1.5 text-right">{t.novos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <details className="mt-8">
        <summary className="cursor-pointer font-titulo text-xl text-verde-escuro">Alunos novos em {alvo} ({r.novos.length})</summary>
        <div className="mt-3">
          <TabelaAlunos alunos={r.novos} mostrarAlvo semBase />
        </div>
      </details>
      <details className="mt-4">
        <summary className="cursor-pointer font-titulo text-xl text-verde-escuro">Concluintes de {base} ({r.concluintes.length})</summary>
        <div className="mt-3">
          <TabelaAlunos alunos={r.concluintes} />
        </div>
      </details>
    </div>
  );
}

function Numero({ rotulo, valor, detalhe, cor = "text-verde-escuro" }: { rotulo: string; valor: number; detalhe?: string; cor?: string }) {
  return (
    <li className="rounded-xl border border-borda bg-white p-3">
      <p className="text-[11px] font-bold tracking-wider text-texto-suave uppercase">{rotulo}</p>
      <p className={`font-titulo text-3xl ${cor}`}>{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe} de quem podia voltar</p>}
    </li>
  );
}

function TabelaAlunos({ alunos, mostrarAlvo = false, semBase = false }: { alunos: AlunoRematricula[]; mostrarAlvo?: boolean; semBase?: boolean }) {
  if (alunos.length === 0) return <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Ninguém.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-borda bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-creme text-left text-xs text-texto-suave">
          <tr>
            <th className="px-3 py-2">Aluno</th>
            {!semBase && <th className="px-3 py-2">Turma anterior</th>}
            {mostrarAlvo && <th className="px-3 py-2">Ano seguinte</th>}
            <th className="px-3 py-2">Responsável financeiro</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map((a) => (
            <tr key={a.codigo} className="border-t border-borda align-top">
              <td className="px-3 py-1.5">
                {a.nome}
                <span className="block text-[11px] text-texto-suave">código {a.codigo}</span>
              </td>
              {!semBase && <td className="px-3 py-1.5">{a.turmaBase ?? "—"}</td>}
              {mostrarAlvo && (
                <td className="px-3 py-1.5">
                  {a.situacaoAlvo ? <span className="text-vinho">matrícula situação {a.situacaoAlvo}</span> : (a.turmaAlvo ?? "—")}
                </td>
              )}
              <td className="px-3 py-1.5">
                {a.responsavel ?? "—"}
                {a.telefone && (
                  <a
                    href={`https://wa.me/${a.telefone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-verde-claro underline-offset-4 hover:underline"
                  >
                    {exibirTelefone(a.telefone)}
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
