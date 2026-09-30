"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4">
      <label className="block">
        <span className="rotulo">E-mail</span>
        <input
          key={estado.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.email}
          className="campo"
        />
      </label>
      <label className="block">
        <span className="rotulo">Senha</span>
        <input name="senha" type="password" autoComplete="current-password" required className="campo" />
      </label>
      {estado.erro && <p className="text-sm text-vinho">{estado.erro}</p>}
      <button type="submit" disabled={enviando} className="botao-primario w-full">
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
