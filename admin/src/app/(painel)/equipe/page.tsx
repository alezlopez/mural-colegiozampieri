import { Avisos } from "@/components/Avisos";
import { exigirArea } from "@/lib/auth";
import { AREAS, PERFIS, type Area, type Nivel } from "@/lib/permissoes";
import { criarClienteServico } from "@/lib/supabase/servico";
import { mudarPerfil, removerMembro, salvarPermissoes } from "./actions";
import { FormNovaSenha, FormNovoMembro } from "./FormsMembro";

type Membro = { user_id: string; nome: string; perfil: keyof typeof PERFIS; created_at: string };

const NIVEIS: [Nivel, string][] = [
  ["nenhum", "Sem acesso"],
  ["ver", "Ver"],
  ["editar", "Editar"],
];

export default async function PaginaEquipe({ searchParams }: PageProps<"/equipe">) {
  const { userId: eu } = await exigirArea("equipe", "editar");
  const p = await searchParams;
  const db = criarClienteServico();

  const [{ data: membros }, { data: linhas }, { data: profs }] = await Promise.all([
    db.from("admins").select("user_id,nome,perfil,created_at").order("nome").overrideTypes<Membro[], { merge: false }>(),
    db.from("perfil_permissoes").select("perfil,area,nivel"),
    db.from("professores").select("user_id").not("user_id", "is", null).eq("ativo", true),
  ]);
  const emails = new Map(
    await Promise.all(
      (membros ?? []).map(async (m) => [m.user_id, (await db.auth.admin.getUserById(m.user_id)).data.user?.email ?? "—"] as const),
    ),
  );
  const professores = new Set((profs ?? []).map((x) => x.user_id as string));
  const nivel = (perfil: string, area: string) => (linhas ?? []).find((l) => l.perfil === perfil && l.area === area)?.nivel ?? "nenhum";
  const areas = (Object.keys(AREAS) as Area[]).filter((a) => a !== "equipe");
  const perfis = Object.entries(PERFIS) as [string, string][];

  return (
    <div>
      <h1 className="font-titulo text-3xl text-verde-escuro">Equipe e permissões</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Quem entra no painel e o que cada perfil pode fazer. A direção pode tudo; coordenação e secretaria seguem a tabela abaixo.
      </p>
      <Avisos salvo={typeof p.salvo === "string" ? p.salvo : null} erro={typeof p.erro === "string" ? p.erro : null} />

      <section className="mt-6">
        <h2 className="mb-2 font-titulo text-xl text-verde-escuro">Pessoas</h2>
        <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
          {(membros ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-verde-escuro">
                  {m.nome}
                  {m.user_id === eu && <span className="ml-1 text-xs font-normal text-texto-suave">(você)</span>}
                  {professores.has(m.user_id) && <span className="ml-1 text-xs font-normal text-texto-suave">· também professor</span>}
                </p>
                <p className="text-xs text-texto-suave">{emails.get(m.user_id)}</p>
                {m.user_id !== eu && <FormNovaSenha userId={m.user_id} />}
              </div>
              <form action={mudarPerfil} className="flex items-center gap-2">
                <input type="hidden" name="user_id" value={m.user_id} />
                <select name="perfil" defaultValue={m.perfil} className="campo !w-auto !py-1.5 text-sm" aria-label={`Perfil de ${m.nome}`}>
                  {perfis.map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
                <button className="botao-secundario !px-3 !py-1.5 text-sm">Salvar</button>
              </form>
              {m.user_id !== eu && (
                <form action={removerMembro}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className="py-1.5 text-sm text-vinho underline-offset-4 hover:underline">Remover</button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <details className="mt-4 rounded-xl border border-borda bg-white p-4">
          <summary className="cursor-pointer font-bold text-verde-escuro">+ Cadastrar pessoa da equipe</summary>
          <p className="mt-2 text-xs text-texto-suave">
            Gera uma senha provisória (aparece uma vez). Se o e-mail já for de um professor, ele entra no painel com a senha do diário.
          </p>
          <FormNovoMembro perfis={perfis} />
        </details>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-titulo text-xl text-verde-escuro">O que cada perfil pode</h2>
        <form action={salvarPermissoes}>
          <div className="overflow-x-auto rounded-xl border border-borda bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-creme text-left text-xs text-texto-suave">
                <tr>
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2">Direção</th>
                  <th className="px-3 py-2">Coordenação</th>
                  <th className="px-3 py-2">Secretaria</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a} className="border-t border-borda align-top">
                    <td className="px-3 py-2">
                      <span className="font-bold text-verde-escuro">{AREAS[a].rotulo}</span>
                      <span className="block text-xs text-texto-suave">{AREAS[a].descricao}</span>
                    </td>
                    <td className="px-3 py-2 text-texto-suave">Editar</td>
                    {(["coordenacao", "secretaria"] as const).map((perfil) => (
                      <td key={perfil} className="px-3 py-2">
                        <select
                          name={`${perfil}:${a}`}
                          defaultValue={nivel(perfil, a)}
                          className="campo !w-auto !py-1.5 text-sm"
                          aria-label={`${PERFIS[perfil]} em ${AREAS[a].rotulo}`}
                        >
                          {NIVEIS.map(([v, r]) => (
                            <option key={v} value={v}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-borda">
                  <td className="px-3 py-2">
                    <span className="font-bold text-verde-escuro">{AREAS.equipe.rotulo}</span>
                    <span className="block text-xs text-texto-suave">{AREAS.equipe.descricao}</span>
                  </td>
                  <td className="px-3 py-2 text-texto-suave">Editar</td>
                  <td className="px-3 py-2 text-texto-suave">Sem acesso</td>
                  <td className="px-3 py-2 text-texto-suave">Sem acesso</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button className="botao-primario mt-3">Salvar permissões</button>
        </form>
        <p className="mt-3 text-xs text-texto-suave">
          &quot;Ver&quot; abre as telas sem poder gravar. As permissões valem nas telas e ações do painel; no banco de dados toda a equipe
          continua com acesso de administração.
        </p>
      </section>
    </div>
  );
}
