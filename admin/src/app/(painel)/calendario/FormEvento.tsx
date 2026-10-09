"use client";

import { useState } from "react";
import Link from "next/link";
import { TIPOS_EVENTO, type EventoCalendario, type TipoEvento } from "@/lib/calendario";
import { salvarEvento } from "./actions";

type Props = { ano: number; evento: EventoCalendario | null; turmas: { id: number; nome: string }[] };

export function FormEvento({ ano, evento, turmas }: Props) {
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? "feriado");
  const [semAula, setSemAula] = useState(evento ? !evento.letivo : TIPOS_EVENTO.feriado.suspende);
  const [escopo, setEscopo] = useState(evento?.turmas?.length ? "turmas" : "escola");

  return (
    <form action={salvarEvento} className="space-y-3">
      <input type="hidden" name="ano" value={ano} />
      {evento && <input type="hidden" name="id" value={evento.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="rotulo">Tipo</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoEvento;
              setTipo(t);
              setSemAula(TIPOS_EVENTO[t].suspende);
            }}
            className="campo"
          >
            {Object.entries(TIPOS_EVENTO).map(([chave, t]) => (
              <option key={chave} value={chave}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rotulo">Título</span>
          <input name="titulo" defaultValue={evento?.titulo} required maxLength={120} className="campo" placeholder="Ex.: Festa Junina" />
        </label>
        <label className="block">
          <span className="rotulo">Início</span>
          <input type="date" name="inicio" defaultValue={evento?.inicio} required className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Fim (se for mais de um dia)</span>
          <input type="date" name="fim" defaultValue={evento && evento.fim !== evento.inicio ? evento.fim : ""} className="campo" />
        </label>
      </div>

      <label className="block">
        <span className="rotulo">Descrição (opcional)</span>
        <textarea name="descricao" defaultValue={evento?.descricao ?? ""} rows={2} maxLength={2000} className="campo" />
      </label>

      <div className="space-y-2 text-sm">
        {tipo !== "sabado_letivo" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="sem_aula" checked={semAula} onChange={(e) => setSemAula(e.target.checked)} />
            Não há aula nesses dias (não conta como dia letivo)
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publico" defaultChecked={evento?.publico ?? true} />
          Aparece para as famílias no app
        </label>
      </div>

      {turmas.length > 0 && (
        <fieldset className="space-y-2 text-sm">
          <legend className="rotulo">Para quem</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="escopo" value="escola" checked={escopo === "escola"} onChange={() => setEscopo("escola")} />
            Escola toda
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="escopo" value="turmas" checked={escopo === "turmas"} onChange={() => setEscopo("turmas")} />
            Só algumas turmas
          </label>
          {escopo === "turmas" && (
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-borda bg-white p-2 sm:grid-cols-2">
              {turmas.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="turmas" value={t.id} defaultChecked={evento?.turmas?.includes(t.id)} />
                  {t.nome}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="botao-primario">{evento ? "Salvar alterações" : "Incluir no calendário"}</button>
        {evento && (
          <Link href={`/calendario?ano=${ano}`} className="text-sm text-texto-suave underline-offset-4 hover:underline">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
