"use client";

import { useActionState } from "react";
import { adicionarMembro, novaSenhaMembro, type EstadoMembro } from "./actions";

function SenhaGerada({ estado }: { estado: EstadoMembro }) {
  if (estado.erro) return <p className="mt-2 text-sm text-vinho">{estado.erro}</p>;
  if (!estado.userId) return null;
  if (!estado.senha)
    return <p className="mt-2 text-sm text-verde-escuro">Incluído. Como já é professor, entra no painel com a mesma senha do diário.</p>;
  return (
    <p role="status" className="mt-2 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
      {estado.email && <>Login: <strong>{estado.email}</strong> · </>}
      Senha provisória: <strong className="font-mono text-base tracking-wider">{estado.senha}</strong>
      <span className="block text-xs text-texto-suave">
        Aparece só agora. Entregue pessoalmente; no primeiro acesso a pessoa cria a própria senha.
      </span>
    </p>
  );
}

export function FormNovoMembro({ perfis }: { perfis: [string, string][] }) {
  const [estado, acao, enviando] = useActionState<EstadoMembro, FormData>(adicionarMembro, {});
  return (
    <form action={acao} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <label className="block">
        <span className="rotulo">Nome</span>
        <input name="nome" required className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">E-mail (login)</span>
        <input name="email" type="email" required className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">Perfil</span>
        <select name="perfil" defaultValue="secretaria" className="campo">
          {perfis.map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <button disabled={enviando} className="botao-primario">
        {enviando ? "Criando…" : "Cadastrar"}
      </button>
      <div className="sm:col-span-4">
        <SenhaGerada estado={estado} />
      </div>
    </form>
  );
}

export function FormNovaSenha({ userId }: { userId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoMembro, FormData>(novaSenhaMembro, {});
  return (
    <form action={acao}>
      <input type="hidden" name="user_id" value={userId} />
      <button disabled={enviando} className="text-xs text-verde-claro underline-offset-4 hover:underline">
        {enviando ? "Gerando…" : "Nova senha provisória"}
      </button>
      <SenhaGerada estado={estado} />
    </form>
  );
}
