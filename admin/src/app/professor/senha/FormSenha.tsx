"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoSenha } from "./actions";

export function FormSenha() {
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
