import type { Route } from "next";
import Link from "next/link";
import { alunosEmRisco, FREQUENCIA_MINIMA } from "@/lib/acompanhamento";
import { exigirArea } from "@/lib/auth";
import { formatarNota } from "@/lib/avaliacao";

const LIMITES = [FREQUENCIA_MINIMA, 80, 85];
const TIPOS = { todos: "Faltas e notas", faltas: "Só faltas", notas: "Só notas" } as const;

export default async function AlunosEmRisco({ searchParams }: PageProps<"/acompanhamento/alunos">) {
  const { supabase } = await exigirArea("acompanhamento");
  const p = await searchParams;
  const limite = LIMITES.includes(Number(p.limite)) ? Number(p.limite) : FREQUENCIA_MINIMA;
  const tipo = (typeof p.tipo === "string" && p.tipo in TIPOS ? p.tipo : "todos") as keyof typeof TIPOS;
  const turmaId = Number(p.turma) || null;

  const r = await alunosEmRisco(supabase, { limitePresenca: limite });
  const lista = r.alunos
    .filter((a) => !turmaId || a.turmaId === turmaId)
    .filter((a) => (tipo === "faltas" ? a.faltas.length > 0 : tipo === "notas" ? a.notas.length > 0 : true));
  const url = (mudar: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    const atual = { limite: limite === FREQUENCIA_MINIMA ? null : limite, tipo: tipo === "todos" ? null : tipo, turma: turmaId, ...mudar };
    for (const [k, v] of Object.entries(atual)) if (v !== null) q.set(k, String(v));
    return `/acompanhamento/alunos${q.size ? `?${q}` : ""}` as Route;
  };

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Alunos em risco {r.ano}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Presença abaixo de {limite}% em alguma disciplina (sobre as aulas com chamada até agora; falta justificada também conta, como no
        boletim) ou média abaixo da média de aprovação em algum bimestre. &quot;Parcial&quot; = ainda faltam avaliações no bimestre. A lei exige{" "}
        {FREQUENCIA_MINIMA}% de presença; 80% e 85% servem de alerta antecipado.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(TIPOS).map(([k, rot]) => (
          <Link key={k} href={url({ tipo: k === "todos" ? null : k })} className={k === tipo ? "botao-primario !px-3 !py-1.5" : "botao-secundario !px-3 !py-1.5"}>
            {rot}
          </Link>
        ))}
        <span className="ml-2 text-xs text-texto-suave">Presença abaixo de</span>
        {LIMITES.map((l) => (
          <Link key={l} href={url({ limite: l === FREQUENCIA_MINIMA ? null : l })} className={l === limite ? "botao-primario !px-3 !py-1.5" : "botao-secundario !px-3 !py-1.5"}>
            {l}%
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2" action="/acompanhamento/alunos">
          {limite !== FREQUENCIA_MINIMA && <input type="hidden" name="limite" value={limite} />}
          {tipo !== "todos" && <input type="hidden" name="tipo" value={tipo} />}
          <select name="turma" defaultValue={turmaId ?? ""} className="campo !w-auto !py-1.5" aria-label="Turma">
            <option value="">Todas as turmas</option>
            {r.turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <button className="botao-secundario !px-3 !py-1.5">Filtrar</button>
        </form>
      </div>

      {lista.length === 0 ? (
        <p className="mt-6 rounded-lg border border-borda bg-white px-4 py-8 text-center text-sm text-texto-suave">
          {r.comChamada === 0 ? "Ainda não há chamadas nem notas lançadas neste ano." : "Nenhum aluno nessa situação."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-borda bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-creme text-left text-xs text-texto-suave">
              <tr>
                <th className="px-3 py-2">Aluno ({lista.length})</th>
                <th className="px-2 py-2 text-right">Presença geral</th>
                <th className="px-3 py-2">Faltas (presença por disciplina)</th>
                <th className="px-3 py-2">Notas abaixo da média</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.codigo} className="border-t border-borda align-top">
                  <td className="px-3 py-2">
                    <Link href={`/alunos/${a.codigo}`} className="font-bold text-verde-escuro hover:underline">
                      {a.nome}
                    </Link>
                    <span className="block text-xs text-texto-suave">{a.turma ?? "sem turma"}</span>
                  </td>
                  <td className={`px-2 py-2 text-right ${a.presencaGeral !== null && a.presencaGeral < limite ? "font-bold text-vinho" : ""}`}>
                    {a.presencaGeral === null ? "—" : `${a.presencaGeral.toString().replace(".", ",")}%`}
                  </td>
                  <td className="px-3 py-2">
                    {a.faltas.length === 0
                      ? "—"
                      : a.faltas.map((f) => (
                          <span key={f.disciplina} className="block">
                            {f.disciplina}: <strong className="text-vinho">{f.presenca.toString().replace(".", ",")}%</strong>{" "}
                            <span className="text-xs text-texto-suave">
                              ({f.ausencias} de {f.aulas}
                              {f.justificadas ? `, ${f.justificadas} justif.` : ""})
                            </span>
                          </span>
                        ))}
                  </td>
                  <td className="px-3 py-2">
                    {a.notas.length === 0
                      ? "—"
                      : a.notas.map((n) => (
                          <span key={`${n.disciplina}:${n.bimestre}`} className="block">
                            {n.disciplina} · {n.bimestre}º bim: <strong className="text-vinho">{formatarNota(n.nota)}</strong>
                            {n.parcial && <span className="text-xs text-texto-suave"> parcial</span>}
                            {n.recuperacaoPendente && <span className="text-xs text-dourado"> · recuperação sem nota</span>}
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
