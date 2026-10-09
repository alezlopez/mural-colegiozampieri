"use client";

import { useActionState } from "react";
import { gerarAcesso, type EstadoAcesso } from "./actions";

export function BotaoAcesso({ professorId, temAcesso, email }: { professorId: number; temAcesso: boolean; email: string | null }) {
  const [estado, acao, enviando] = useActionState<EstadoAcesso, FormData>(gerarAcesso, {});

  if (estado.senha) {
    return (
      <div className="rounded-md border border-dourado/40 bg-dourado/10 p-3 text-sm">
        <p className="font-bold text-verde-escuro">Senha provisória (aparece só agora):</p>
        <p className="my-1 select-all font-mono text-lg tracking-wider text-texto">{estado.senha}</p>
        <p className="text-texto-suave">
          Entregue ao professor junto com o e-mail <strong>{email}</strong>. No primeiro acesso ele cria a própria senha.
        </p>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-1">
      <input type="hidden" name="professor_id" value={professorId} />
      <button type="submit" disabled={enviando || !email} className={temAcesso ? "botao-secundario" : "botao-primario"}>
        {enviando ? "Gerando…" : temAcesso ? "Nova senha provisória" : "Criar acesso"}
      </button>
      {estado.erro && <p className="max-w-xs text-xs text-vinho">{estado.erro}</p>}
    </form>
  );
}
