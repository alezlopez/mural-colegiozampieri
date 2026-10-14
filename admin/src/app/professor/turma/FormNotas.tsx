"use client";

import { useActionState, useState } from "react";
import { CHAVE_RECUPERACAO, formatarNota, lerNota, resultadoBimestre, type RegraAvaliacao } from "@/lib/avaliacao";
import { salvarNotas, type EstadoNotas } from "./notas-actions";

type Aluno = { codigo: string; nome: string; numero: number | null };

type Props = {
  turmaId: number;
  disciplinaId: number;
  ano: number;
  bimestre: number;
  regra: RegraAvaliacao;
  alunos: Aluno[];
  /** aluno → avaliação → nota */
  notas: Record<string, Record<string, number>>;
  pareceres: Record<string, string>;
};

const texto = (n: number | undefined) => (typeof n === "number" ? String(n).replace(".", ",") : "");

export function FormNotas(props: Props) {
  const { regra } = props;
  const [estado, acao, enviando] = useActionState<EstadoNotas, FormData>(salvarNotas, {});
  // Valores digitados (texto), para recalcular a média na hora.
  const [valores, setValores] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      props.alunos.map((a) => [
        a.codigo,
        Object.fromEntries([...regra.avaliacoes.map((av) => av.chave), CHAVE_RECUPERACAO].map((c) => [c, texto(props.notas[a.codigo]?.[c])])),
      ]),
    ),
  );

  const resultado = (codigo: string) => {
    const lidas: Record<string, number> = {};
    for (const [c, t] of Object.entries(valores[codigo] ?? {})) {
      const n = lerNota(t);
      if (typeof n === "number" && !Number.isNaN(n)) lidas[c] = n;
    }
    return resultadoBimestre(lidas, regra);
  };
  const algumEmRecuperacao = props.alunos.some((a) => resultado(a.codigo).emRecuperacao || valores[a.codigo]?.[CHAVE_RECUPERACAO]);
  const mudar = (codigo: string, chave: string, t: string) => setValores((v) => ({ ...v, [codigo]: { ...v[codigo], [chave]: t } }));

  const ocultos = (
    <>
      <input type="hidden" name="turma_id" value={props.turmaId} />
      <input type="hidden" name="disciplina_id" value={props.disciplinaId} />
      <input type="hidden" name="ano" value={props.ano} />
      <input type="hidden" name="bimestre" value={props.bimestre} />
    </>
  );
  const rodape = (
    <div className="fixed inset-x-0 bottom-0 border-t border-borda bg-white/95 p-3 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        {estado.erro && <p className="mb-2 text-sm text-vinho">{estado.erro}</p>}
        <button type="submit" disabled={enviando} className="botao-primario w-full !py-3.5">
          {enviando ? "Salvando…" : regra.descritivo ? "Salvar pareceres" : "Salvar notas"}
        </button>
      </div>
    </div>
  );

  if (props.alunos.length === 0) {
    return <p className="rounded-lg border border-borda bg-white p-4 text-sm text-texto-suave">Nenhum aluno nesta turma.</p>;
  }

  if (regra.descritivo) {
    return (
      <form action={acao} className="space-y-3 pb-24">
        {ocultos}
        {props.alunos.map((a) => (
          <label key={a.codigo} className="block rounded-xl border border-borda bg-white p-3">
            <span className="mb-1 block text-sm font-bold text-verde-escuro">
              {a.numero ? `${a.numero}. ` : ""}
              {a.nome}
            </span>
            <textarea name={`p_${a.codigo}`} defaultValue={props.pareceres[a.codigo] ?? ""} rows={4} maxLength={6000} className="campo" placeholder="Parecer descritivo do bimestre" />
          </label>
        ))}
        {rodape}
      </form>
    );
  }

  return (
    <form action={acao} className="pb-24">
      {ocultos}
      <div className="overflow-x-auto rounded-xl border border-borda bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-creme text-left text-xs text-texto-suave">
            <tr>
              <th className="px-3 py-2">Aluno</th>
              {regra.avaliacoes.map((av) => (
                <th key={av.chave} className="px-1 py-2 text-center" title={`Peso ${av.peso}`}>
                  {av.nome}
                </th>
              ))}
              <th className="px-2 py-2 text-center">Média</th>
              {regra.recuperacao_bimestral && algumEmRecuperacao && <th className="px-1 py-2 text-center">Recuperação</th>}
              {regra.recuperacao_bimestral && algumEmRecuperacao && <th className="px-2 py-2 text-center">Final</th>}
            </tr>
          </thead>
          <tbody>
            {props.alunos.map((a) => {
              const r = resultado(a.codigo);
              const campo = (chave: string) => (
                <input
                  name={`n_${a.codigo}__${chave}`}
                  value={valores[a.codigo]?.[chave] ?? ""}
                  onChange={(e) => mudar(a.codigo, chave, e.target.value)}
                  inputMode="decimal"
                  aria-label={`${a.nome}: ${chave === CHAVE_RECUPERACAO ? "recuperação" : regra.avaliacoes.find((x) => x.chave === chave)?.nome}`}
                  className={`w-16 rounded border px-1.5 py-1.5 text-center ${
                    Number.isNaN(lerNota(valores[a.codigo]?.[chave] ?? "")) ? "border-vinho bg-vinho/5" : "border-borda"
                  }`}
                />
              );
              const abaixo = r.media !== null && r.media < regra.media_aprovacao;
              return (
                <tr key={a.codigo} className="border-t border-borda">
                  <td className="px-3 py-1.5">
                    <span className="block max-w-[11rem] truncate">
                      {a.numero ? `${a.numero}. ` : ""}
                      {a.nome}
                    </span>
                  </td>
                  {regra.avaliacoes.map((av) => (
                    <td key={av.chave} className="px-1 py-1 text-center">
                      {campo(av.chave)}
                    </td>
                  ))}
                  <td className={`px-2 py-1.5 text-center font-bold ${r.media === null ? "text-texto-suave" : abaixo ? "text-vinho" : "text-verde-claro"}`}>
                    {r.media !== null ? formatarNota(r.media) : r.parcial !== null ? <span className="font-normal">({formatarNota(r.parcial)})</span> : "—"}
                  </td>
                  {regra.recuperacao_bimestral && algumEmRecuperacao && (
                    <td className="px-1 py-1 text-center">{r.emRecuperacao || valores[a.codigo]?.[CHAVE_RECUPERACAO] ? campo(CHAVE_RECUPERACAO) : null}</td>
                  )}
                  {regra.recuperacao_bimestral && algumEmRecuperacao && (
                    <td className={`px-2 py-1.5 text-center font-bold ${r.final !== null && r.final < regra.media_aprovacao ? "text-vinho" : "text-verde-escuro"}`}>
                      {r.emRecuperacao ? formatarNota(r.final) : ""}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-texto-suave">
        Média com o arredondamento da escola; entre parênteses, a parcial enquanto faltam notas. Abaixo de{" "}
        {formatarNota(regra.media_aprovacao)}, abre a recuperação: se a nota dela for maior, substitui a média. Apague uma nota
        para tirá-la.
      </p>
      {rodape}
    </form>
  );
}
