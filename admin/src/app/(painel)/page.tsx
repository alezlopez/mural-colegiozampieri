import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { CATEGORIAS, ORDEM_CATEGORIAS, ehCategoria, type Categoria } from "@/lib/categorias";
import { formatarDataHora } from "@/lib/datas";
import { criarClienteServico } from "@/lib/supabase/servico";
import { alternarFixado } from "./actions";

type Linha = {
  id: string;
  categoria: Categoria;
  titulo: string;
  status: "rascunho" | "publicado";
  fixado: boolean;
  turmas: string[] | null;
  publicado_em: string | null;
  updated_at: string;
  push_enviado_em: string | null;
  push_dispositivos: number | null;
  post_imagens: { count: number }[];
};

function Mensagem({ params }: { params: Record<string, string | string[] | undefined> }) {
  const { salvo, push, falhas } = params;
  if (!salvo) return null;
  const textos: Record<string, string> = {
    publicado: "Publicação no ar.",
    rascunho: "Rascunho salvo.",
    excluido: "Publicação excluída.",
  };
  let pushTexto = "";
  if (push === "erro") pushTexto = " Não foi possível enviar a notificação — verifique a configuração do push.";
  else if (push !== undefined) {
    pushTexto = ` Notificação enviada para ${push} aparelho(s)${falhas && falhas !== "0" ? ` (${falhas} falharam)` : ""}.`;
  }
  const erro = push === "erro";
  return (
    <p
      role="status"
      className={`mb-6 rounded-md border px-4 py-3 text-sm ${erro ? "border-vinho/30 bg-vinho/5 text-vinho" : "border-verde-claro/30 bg-verde-claro/10 text-verde-escuro"}`}
    >
      {textos[String(salvo)] ?? "Salvo."}
      {pushTexto}
    </p>
  );
}

export default async function Painel({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filtro = ehCategoria(params.categoria) ? params.categoria : undefined;
  const { supabase } = await exigirAdmin();

  let consulta = supabase
    .from("posts")
    .select(
      "id, categoria, titulo, status, fixado, turmas, publicado_em, updated_at, push_enviado_em, push_dispositivos, post_imagens(count)",
    )
    .order("status", { ascending: true })
    .order("fixado", { ascending: false })
    .order("publicado_em", { ascending: false, nullsFirst: true })
    .limit(100);
  if (filtro) consulta = consulta.eq("categoria", filtro);
  const { data: posts, error } = await consulta.returns<Linha[]>();

  let dispositivos: number | null = null;
  try {
    const { count } = await criarClienteServico()
      .from("push_tokens")
      .select("token", { count: "exact", head: true })
      .is("desativado_em", null);
    dispositivos = count;
  } catch {
    dispositivos = null;
  }

  return (
    <>
      <Mensagem params={params} />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.25em] text-dourado">MURAL DA ESCOLA</p>
          <h1 className="font-titulo text-4xl text-verde-escuro">Publicações</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {dispositivos === null
              ? "Configure SUPABASE_SERVICE_ROLE_KEY para ver os aparelhos cadastrados."
              : `${dispositivos} aparelho(s) recebendo notificações.`}
          </p>
        </div>
        <Link href="/posts/novo" className="botao-dourado">
          + Nova publicação
        </Link>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar por categoria">
        {[undefined, ...ORDEM_CATEGORIAS].map((c) => {
          const ativo = c === filtro;
          return (
            <Link
              key={c ?? "todas"}
              href={c ? `/?categoria=${c}` : "/"}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition ${ativo ? "border-verde-medio bg-verde-medio text-white" : "border-borda bg-white text-texto-suave hover:border-verde-claro"}`}
            >
              {c ? CATEGORIAS[c].rotulo : "Todas"}
            </Link>
          );
        })}
      </nav>

      {error && <p className="text-vinho">Erro ao carregar publicações: {error.message}</p>}

      {posts && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-borda bg-white px-6 py-16 text-center">
          <p className="font-titulo text-2xl text-verde-escuro">Nenhuma publicação ainda</p>
          <p className="mt-2 text-sm text-texto-suave">Crie o primeiro comunicado para a comunidade escolar.</p>
        </div>
      )}

      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-white">
        {posts?.map((p) => {
          const fotos = p.post_imagens[0]?.count ?? 0;
          return (
            <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase ${CATEGORIAS[p.categoria].classe}`}
                  >
                    {CATEGORIAS[p.categoria].rotulo}
                  </span>
                  {p.status === "rascunho" && (
                    <span className="rounded border border-borda px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-texto-suave uppercase">
                      Rascunho
                    </span>
                  )}
                  {p.turmas && (
                    <span className="rounded border border-verde-claro/40 bg-verde-claro/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-verde-medio">
                      {p.turmas.length === 1 ? `Turma ${p.turmas[0]}` : `${p.turmas.length} turmas`}
                    </span>
                  )}
                  {p.fixado && (
                    <span className="text-[10px] font-bold tracking-[0.12em] text-dourado uppercase">✦ Fixado</span>
                  )}
                </div>
                <Link href={`/posts/${p.id}`} className="block truncate font-titulo text-lg text-verde-escuro hover:underline">
                  {p.titulo}
                </Link>
                <p className="text-xs text-texto-suave">
                  {p.publicado_em ? `Publicado em ${formatarDataHora(p.publicado_em)}` : `Editado em ${formatarDataHora(p.updated_at)}`}
                  {fotos > 0 && ` · ${fotos} foto(s)`}
                  {p.push_enviado_em && ` · 🔔 notificado (${p.push_dispositivos ?? 0})`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.status === "publicado" && (
                  <form action={alternarFixado}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="fixar" value={p.fixado ? "0" : "1"} />
                    <button className="botao-secundario !px-3 !py-2 !text-[11px]">{p.fixado ? "Desafixar" : "Fixar"}</button>
                  </form>
                )}
                <Link href={`/posts/${p.id}`} className="botao-secundario !px-3 !py-2 !text-[11px]">
                  Editar
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
