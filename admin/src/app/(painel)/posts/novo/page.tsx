import Link from "next/link";
import { PostForm } from "@/components/PostForm";
import { exigirAdmin } from "@/lib/auth";

export default async function NovaPublicacao() {
  const { supabase } = await exigirAdmin();
  const { data: turmas } = await supabase.rpc("turmas_ativas");

  return (
    <>
      <Link href="/" className="text-sm text-texto-suave hover:text-verde-medio">
        ← Voltar às publicações
      </Link>
      <h1 className="mb-8 mt-2 font-titulo text-4xl text-verde-escuro">Nova publicação</h1>
      <PostForm turmasDisponiveis={(turmas as string[] | null) ?? []} />
    </>
  );
}
