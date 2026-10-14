"use client";

import { useActionState } from "react";
import type { EstadoSenha } from "./actions";

/** Formulário de nova senha; serve ao professor e à equipe do painel (cada um com a sua ação). */
export function FormSenha({ trocarSenha }: { trocarSenha: (e: EstadoSenha, f: FormData) => Promise<EstadoSenha> }) {
  const [estado, acao, enviando] = useActionState<EstadoSenha, FormData>(trocarSenha, {});
  return (
    <form action={acao} className="space-y-4">
      <label className="block">
        <span className="rotulo">Nova senha</span>
        <input name="senha" type="password" autoComplete="new-password" minLength={8} required className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">Repita a nova senha</span>
        <input name="confirmacao" type="password" autoComplete="new-password" minLength={8} required className="campo" />
      </label>
      {estado.erro && <p className="text-sm text-vinho">{estado.erro}</p>}
      <button type="submit" disabled={enviando} className="botao-primario w-full">
        {enviando ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
