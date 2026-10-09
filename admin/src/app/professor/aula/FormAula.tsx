"use client";

import { useActionState, useState } from "react";
import { salvarAula, type EstadoAula } from "./actions";

type Aluno = { codigo: string; nome: string; numero: number | null };
type Status = "presente" | "falta" | "falta_justificada";

const ROTULO: Record<Status, string> = { presente: "P", falta: "F", falta_justificada: "FJ" };
const PROXIMO: Record<Status, Status> = { presente: "falta", falta: "falta_justificada", falta_justificada: "presente" };

export function FormAula(props: {
  turmaId: number;
  disciplinaId: number;
  aulaNumero: number;
  data: string;
  conteudo: string;
  tarefa: string;
  entrega: string;
  alunos: Aluno[];
  chamada: Record<string, Status>;
}) {
  const [estado, acao, enviando] = useActionState<EstadoAula, FormData>(salvarAula, {});
  const [conteudo, setConteudo] = useState(props.conteudo);
  const [tarefa, setTarefa] = useState(props.tarefa);
  const [entrega, setEntrega] = useState(props.entrega);
  const [chamada, setChamada] = useState<Record<string, Status>>(() =>
    Object.fromEntries(props.alunos.map((a) => [a.codigo, props.chamada[a.codigo] ?? "presente"])),
  );
  const faltas = Object.values(chamada).filter((s) => s !== "presente").length;

  return (
    <form action={acao} className="space-y-5 pb-24">
      <input type="hidden" name="turma_id" value={props.turmaId} />
      <input type="hidden" name="disciplina_id" value={props.disciplinaId} />
      <input type="hidden" name="aula_numero" value={props.aulaNumero} />
      <input type="hidden" name="data" value={props.data} />

      <label className="block">
        <span className="rotulo">Conteúdo da aula</span>
        <textarea
          name="conteudo"
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          required
          rows={3}
          placeholder="Ex.: Frações equivalentes, exercícios das páginas 40 e 41"
          className="campo"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="rotulo">Tarefa de casa (opcional)</span>
          <textarea
            name="tarefa"
            value={tarefa}
            onChange={(e) => setTarefa(e.target.value)}
            rows={2}
            placeholder="Ex.: Livro p. 42, exercícios 1 a 5"
            className="campo"
          />
        </label>
        <label className="block">
          <span className="rotulo">Entregar em</span>
          <input
            name="tarefa_entrega"
            type="date"
            value={entrega}
            onChange={(e) => setEntrega(e.target.value)}
            disabled={!tarefa.trim()}
            className="campo"
          />
        </label>
      </div>

      <fieldset>
        <legend className="rotulo flex w-full justify-between">
          <span>Chamada · toque para alternar P / F / FJ</span>
          <span className={faltas ? "text-vinho" : ""}>{faltas} ausente{faltas === 1 ? "" : "s"}</span>
        </legend>
        {props.alunos.length === 0 ? (
          <p className="rounded-md border border-borda bg-white p-3 text-sm text-texto-suave">
            Nenhum aluno matriculado nesta turma (a lista vem da sincronização com a Mhund).
          </p>
        ) : (
          <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
            {props.alunos.map((a) => {
              const s = chamada[a.codigo];
              return (
                <li key={a.codigo}>
                  <input type="hidden" name={`freq_${a.codigo}`} value={s} />
                  <button
                    type="button"
                    onClick={() => setChamada((c) => ({ ...c, [a.codigo]: PROXIMO[c[a.codigo]] }))}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-creme"
                  >
                    <span className="w-6 text-right text-xs text-texto-suave">{a.numero ?? ""}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-texto">{a.nome}</span>
                    <span
                      className={`w-11 rounded-md py-1 text-center text-sm font-bold ${
                        s === "presente" ? "bg-verde-claro/15 text-verde-claro" : s === "falta" ? "bg-vinho text-white" : "bg-dourado/20 text-dourado"
                      }`}
                    >
                      {ROTULO[s]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 border-t border-borda bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {estado.erro && <p className="mb-2 text-sm text-vinho">{estado.erro}</p>}
          <button type="submit" disabled={enviando} className="botao-primario w-full !py-3.5">
            {enviando ? "Salvando…" : "Salvar aula e chamada"}
          </button>
        </div>
      </div>
    </form>
  );
}
