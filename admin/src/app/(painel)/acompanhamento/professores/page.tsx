import Link from "next/link";
import { pct, resumoProfessores, type LinhaProfessor } from "@/lib/acompanhamento";
import { exigirArea } from "@/lib/auth";
import { formatarDataCurta, formatarDataHora } from "@/lib/datas";
import { AvisosDeCadastro } from "../AvisosDeCadastro";

export default async function AcompanhamentoProfessores() {
  const { supabase } = await exigirArea("acompanhamento");
  const r = await resumoProfessores(supabase);
  const semChamada = r.professores.some((p) => p.semChamada > 0);

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Professores em dia</h1>
      <p className="mt-1 text-sm text-texto-suave">
        {r.temBimestres ? `${r.bimestre}º bimestre de ${r.ano}` : r.ano}
        {r.de <= r.ate ? `, de ${formatarDataCurta(r.de)} a ${formatarDataCurta(r.ate)}` : ""}: aulas previstas pelo horário × lançadas no
        diário, chamadas, notas do bimestre e planejamentos. A lista de cada aula atrasada está em{" "}
        <Link href="/pendencias" className="underline">
          Aulas não lançadas
        </Link>
        .
      </p>
      <AvisosDeCadastro ano={r.ano} temAnoLetivo={r.temAnoLetivo} temBimestres={r.temBimestres} semHorario={r.temAnoLetivo && r.professores.every((p) => p.previstas === 0)} />

      {r.professores.length === 0 ? (
        <p className="mt-6 rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          Nenhuma disciplina nas turmas de {r.ano}. Monte a matriz curricular e atribua os professores.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {r.professores.map((p) => (
            <li key={p.chave}>
              <details className="rounded-xl border border-borda bg-white">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-4">
                  <span className="min-w-0 flex-1 font-titulo text-lg text-verde-escuro">
                    {p.nome}
                    {p.chave !== "sem" && !p.temAcesso && <span className="ml-2 text-xs font-bold text-dourado">SEM ACESSO AO DIÁRIO</span>}
                  </span>
                  <Resumo rotulo="aulas" valor={pct(p.lancadas, p.previstas)} alerta={p.pendentes > 0} detalhe={p.pendentes ? `${p.pendentes} atrasada${p.pendentes === 1 ? "" : "s"}` : "em dia"} />
                  {p.semChamada > 0 && <Resumo rotulo="sem chamada" valor={String(p.semChamada)} alerta />}
                  <Resumo rotulo={`notas ${r.bimestre}º bim.`} valor={pct(p.notasLancadas, p.notasEsperadas)} />
                  {p.aguardandoVisto > 0 && <Resumo rotulo="planej. sem visto" valor={String(p.aguardandoVisto)} />}
                  <span className="text-xs text-texto-suave">
                    {p.ultimoLancamento ? `último lançamento ${formatarDataHora(p.ultimoLancamento)}` : "nunca lançou"}
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-borda">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-creme text-left text-xs text-texto-suave">
                      <tr>
                        <th className="px-3 py-2">Turma · disciplina</th>
                        <th className="px-2 py-2 text-right">Aulas</th>
                        {semChamada && <th className="px-2 py-2 text-right">Sem chamada</th>}
                        <th className="px-2 py-2 text-right">Notas</th>
                        <th className="px-3 py-2">Último planejamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.linhas.map((l) => (
                        <Linha key={`${l.turmaId}:${l.disciplina}`} l={l} comChamada={semChamada} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, detalhe, alerta = false }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <span className="text-right text-xs text-texto-suave">
      <strong className={`block text-base ${alerta ? "text-vinho" : "text-verde-escuro"}`}>{valor}</strong>
      {detalhe ?? rotulo}
    </span>
  );
}

function Linha({ l, comChamada }: { l: LinhaProfessor; comChamada: boolean }) {
  const atrasadas = l.previstas === null ? 0 : Math.max(0, l.previstas - l.lancadas);
  return (
    <tr className="border-t border-borda">
      <td className="px-3 py-1.5">
        <Link href={`/turmas/${l.turmaId}`} className="hover:underline">
          {l.turma}
        </Link>{" "}
        · {l.disciplina}
      </td>
      <td className={`px-2 py-1.5 text-right ${atrasadas ? "font-bold text-vinho" : ""}`}>
        {l.previstas === null ? l.lancadas : `${Math.min(l.lancadas, l.previstas)}/${l.previstas}`}
      </td>
      {comChamada && <td className={`px-2 py-1.5 text-right ${l.semChamada ? "font-bold text-vinho" : ""}`}>{l.semChamada || "—"}</td>}
      <td className="px-2 py-1.5 text-right">{l.notas ? `${Math.min(l.notas.lancadas, l.notas.esperadas)}/${l.notas.esperadas}` : "—"}</td>
      <td className="px-3 py-1.5">
        {l.planejamento.ultimoInicio ? `semana/mês de ${formatarDataCurta(l.planejamento.ultimoInicio)}` : <span className="text-vinho">nenhum</span>}
        {l.planejamento.aguardandoVisto > 0 && <span className="ml-1 text-xs text-texto-suave">({l.planejamento.aguardandoVisto} sem visto)</span>}
      </td>
    </tr>
  );
}
