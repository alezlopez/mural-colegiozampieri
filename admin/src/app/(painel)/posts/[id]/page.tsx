import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm, type PostInicial } from "@/components/PostForm";
import { exigirAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { excluirPost } from "../../actions";
import { BotaoExcluir } from "./BotaoExcluir";

export default async function EditarPublicacao({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  const { supabase } = await exigirAdmin();

  const { data } = await supabase
    .from("posts")
    .select(
      "id, categoria, titulo, corpo, data_evento, fixado, status, publicado_em, push_enviado_em, push_dispositivos, post_imagens(storage_path, largura, altura, posicao)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const imagens = [...(data.post_imagens as (PostInicial["imagens"][number] & { posicao: number })[])]
    .sort((a, b) => a.posicao - b.posicao)
    .map(({ storage_path, largura, altura }) => ({ storage_path, largura, altura }));

  const inicial: PostInicial = {
    id: data.id,
    categoria: data.categoria,
    titulo: data.titulo,
    corpo: data.corpo,
    data_evento: data.data_evento,
    fixado: data.fixado,
    status: data.status,
    push_enviado_em: data.push_enviado_em,
    imagens,
  };

  return (
    <>
      <Link href="/" className="text-sm text-texto-suave hover:text-verde-medio">
        ← Voltar às publicações
      </Link>
      <div className="mb-8 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-4xl text-verde-escuro">Editar publicação</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {data.publicado_em ? `Publicado em ${formatarDataHora(data.publicado_em)}` : "Rascunho"}
            {data.push_enviado_em &&
              ` · notificação enviada em ${formatarDataHora(data.push_enviado_em)} para ${data.push_dispositivos ?? 0} aparelho(s)`}
          </p>
        </div>
        <form action={excluirPost}>
          <input type="hidden" name="id" value={data.id} />
          <BotaoExcluir />
        </form>
      </div>
      <PostForm inicial={inicial} />
    </>
  );
}
