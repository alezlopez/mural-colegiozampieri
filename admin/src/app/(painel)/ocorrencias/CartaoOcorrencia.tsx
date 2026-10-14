import Link from "next/link";
import { formatarDataCurta, formatarDataHora } from "@/lib/datas";
import { STATUS_OCORRENCIA, TIPOS_OCORRENCIA, type Ocorrencia } from "@/lib/ocorrencias";
import { excluirOcorrencia, revisarOcorrencia } from "./actions";

const COR_STATUS = { pendente: "bg-dourado/20 text-texto", publicada: "bg-verde-claro/15 text-verde-escuro", interna: "bg-creme text-texto-suave" } as const;

/** Ocorrência com a revisão da coordenação (editar texto, enviar à família, deixar interna, excluir). */
export function CartaoOcorrencia({
  o,
  aluno,
  turma,
  disciplina,
  volta,
  podeEditar,
}: {
  o: Ocorrencia;
  aluno?: string;
  turma?: string | null;
  disciplina?: string | null;
  volta: string;
  podeEditar: boolean;
}) {
  return (
    <li className="rounded-xl border border-borda bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {aluno && (
          <Link href={`/alunos/${o.aluno_codigo}`} className="font-bold text-verde-escuro hover:underline">
            {aluno}
          </Link>
        )}
        {turma && <span className="text-xs text-texto-suave">{turma}</span>}
        <span className="text-xs text-texto-suave">{formatarDataCurta(o.data)}</span>
        <span className="text-xs font-bold text-texto">{TIPOS_OCORRENCIA[o.tipo]}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${COR_STATUS[o.status]}`}>{STATUS_OCORRENCIA[o.status]}</span>
        {o.status === "publicada" && o.exige_ciencia && (
          <span className={`text-[11px] font-bold ${o.ciencia_em ? "text-verde-claro" : "text-vinho"}`}>
            {o.ciencia_em ? `ciente em ${formatarDataHora(o.ciencia_em)}` : "ciência pendente"}
          </span>
        )}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-texto">{o.descricao}</p>
      {o.providencia && (
        <p className="mt-1 whitespace-pre-line text-sm text-texto-suave">
          <strong>Providência:</strong> {o.providencia}
        </p>
      )}
      <p className="mt-1 text-xs text-texto-suave">
        Registrada por {o.registrado_por_nome}
        {disciplina ? ` (${disciplina})` : ""} em {formatarDataHora(o.criado_em)}
        {o.publicada_em ? ` · enviada à família em ${formatarDataHora(o.publicada_em)}` : ""}
      </p>

      {podeEditar && (
        <details className="mt-3" open={o.status === "pendente"}>
          <summary className="cursor-pointer text-sm font-bold text-verde-claro">{o.status === "pendente" ? "Revisar" : "Editar"}</summary>
          <form action={revisarOcorrencia} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="volta" value={volta} />
            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="rotulo">Tipo</span>
                <select name="tipo" defaultValue={o.tipo} className="campo !w-auto">
                  {Object.entries(TIPOS_OCORRENCIA).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="exige_ciencia" defaultChecked={o.exige_ciencia} />
                Pedir ciência do responsável
              </label>
            </div>
            <label className="block">
              <span className="rotulo">Descrição (a família lê este texto)</span>
              <textarea name="descricao" defaultValue={o.descricao} rows={4} className="campo" required minLength={3} maxLength={4000} />
            </label>
            <label className="block">
              <span className="rotulo">Providência tomada (opcional)</span>
              <textarea name="providencia" defaultValue={o.providencia ?? ""} rows={2} className="campo" maxLength={2000} />
            </label>
            <div className="flex flex-wrap gap-2">
              {o.status !== "publicada" ? (
                <button name="acao" value="publicar" className="botao-primario">
                  Enviar à família
                </button>
              ) : (
                <button name="acao" value="salvar" className="botao-primario">
                  Salvar
                </button>
              )}
              {o.status !== "interna" && (
                <button name="acao" value="interna" className="botao-secundario">
                  {o.status === "publicada" ? "Retirar do app (interna)" : "Deixar como interna"}
                </button>
              )}
              {o.status === "interna" && (
                <button name="acao" value="salvar" className="botao-secundario">
                  Salvar como interna
                </button>
              )}
            </div>
          </form>
          {o.status !== "publicada" && (
            <form action={excluirOcorrencia} className="mt-2">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="volta" value={volta} />
              <button className="text-xs text-vinho underline-offset-4 hover:underline">Excluir</button>
            </form>
          )}
        </details>
      )}
    </li>
  );
}
