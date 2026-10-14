import Link from "next/link";
import { Indicador } from "@/components/Indicador";
import { alunosEmRisco, FREQUENCIA_MINIMA, pct, resumoProfessores } from "@/lib/acompanhamento";
import { exigirArea } from "@/lib/auth";
import { formatarDataCurta } from "@/lib/datas";
import { AvisosDeCadastro } from "./AvisosDeCadastro";

export default async function VisaoGeral() {
  const { supabase } = await exigirArea("acompanhamento");
  const [prof, risco, { count: aguardandoVisto }] = await Promise.all([
    resumoProfessores(supabase),
    alunosEmRisco(supabase),
    supabase.from("planejamentos").select("id", { count: "exact", head: true }).is("visto_em", null),
  ]);

  const previstas = prof.professores.reduce((s, p) => s + p.previstas, 0);
  const lancadas = prof.professores.reduce((s, p) => s + p.lancadas, 0);
  const semChamada = prof.professores.reduce((s, p) => s + p.semChamada, 0);
  const comPendencia = prof.professores.filter((p) => p.chave !== "sem" && p.pendentes > 0);
  const porFaltas = risco.alunos.filter((a) => a.faltas.length > 0);
  const porNotas = risco.alunos.filter((a) => a.notas.length > 0);
  const notasEsperadas = prof.professores.reduce((s, p) => s + p.notasEsperadas, 0);
  const notasLancadas = prof.professores.reduce((s, p) => s + p.notasLancadas, 0);

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Visão geral {prof.ano}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        {prof.temBimestres ? `${prof.bimestre}º bimestre` : "Ano"}
        {prof.de <= prof.ate ? `, de ${formatarDataCurta(prof.de)} a ${formatarDataCurta(prof.ate)} (até ontem)` : ""}. Os números dependem do
        que os professores lançam no diário.
      </p>
      <AvisosDeCadastro ano={prof.ano} temAnoLetivo={prof.temAnoLetivo} temBimestres={prof.temBimestres} semHorario={prof.temAnoLetivo && previstas === 0} />

      <h2 className="mt-6 rotulo">Professores</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Indicador rotulo="Aulas lançadas" valor={pct(lancadas, previstas)} detalhe={`${lancadas} de ${previstas} previstas`} alerta={previstas > 0 && lancadas / previstas < 0.9} href="/pendencias" />
        <Indicador rotulo="Com aulas atrasadas" valor={comPendencia.length} detalhe="professores" alerta={comPendencia.length > 0} href="/acompanhamento/professores" />
        <Indicador rotulo="Aulas sem chamada" valor={semChamada} detalhe="conteúdo lançado, frequência não" alerta={semChamada > 0} href="/acompanhamento/professores" />
        <Indicador rotulo={`Notas do ${prof.bimestre}º bim.`} valor={pct(notasLancadas, notasEsperadas)} detalhe={`${notasLancadas} de ${notasEsperadas}`} href="/acompanhamento/professores" />
        <Indicador rotulo="Planejamentos" valor={aguardandoVisto ?? 0} detalhe="aguardando visto" alerta={(aguardandoVisto ?? 0) > 0} href="/planejamentos" />
      </ul>

      <h2 className="mt-6 rotulo">Alunos</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Indicador
          rotulo={`Presença abaixo de ${FREQUENCIA_MINIMA}%`}
          valor={porFaltas.length}
          detalhe="em ao menos uma disciplina"
          alerta={porFaltas.length > 0}
          href="/acompanhamento/alunos?tipo=faltas"
        />
        <Indicador rotulo="Abaixo da média" valor={porNotas.length} detalhe="em ao menos um bimestre" alerta={porNotas.length > 0} href="/acompanhamento/alunos?tipo=notas" />
        <Indicador rotulo="Com chamada registrada" valor={risco.comChamada} detalhe="alunos com frequência no ano" />
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-end gap-2">
            <h2 className="flex-1 font-titulo text-xl text-verde-escuro">Mais aulas atrasadas</h2>
            <Link href="/acompanhamento/professores" className="text-sm text-verde-claro underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          {comPendencia.length === 0 ? (
            <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Ninguém com aula atrasada no período.</p>
          ) : (
            <ul className="divide-y divide-borda rounded-xl border border-borda bg-white">
              {comPendencia.slice(0, 6).map((p) => (
                <li key={p.chave} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  <span className="font-bold text-vinho">{p.pendentes} atrasada{p.pendentes === 1 ? "" : "s"}</span>
                  <span className="text-xs text-texto-suave">{pct(p.lancadas, p.previstas)} em dia</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="mb-2 flex items-end gap-2">
            <h2 className="flex-1 font-titulo text-xl text-verde-escuro">Alunos que pedem atenção</h2>
            <Link href="/acompanhamento/alunos" className="text-sm text-verde-claro underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          {risco.alunos.length === 0 ? (
            <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Nenhum aluno abaixo da presença mínima ou da média.</p>
          ) : (
            <ul className="divide-y divide-borda rounded-xl border border-borda bg-white">
              {risco.alunos.slice(0, 8).map((a) => (
                <li key={a.codigo}>
                  <Link href={`/alunos/${a.codigo}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-creme">
                    <span className="min-w-0 flex-1 truncate">
                      {a.nome} <span className="text-xs text-texto-suave">· {a.turma ?? "sem turma"}</span>
                    </span>
                    {a.faltas.length > 0 && <span className="text-xs font-bold text-vinho">faltas em {a.faltas.length}</span>}
                    {a.notas.length > 0 && <span className="text-xs font-bold text-vinho">nota em {a.notas.length}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
