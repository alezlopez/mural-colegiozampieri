import Link from "next/link";
import { PostForm } from "@/components/PostForm";

export default function NovaPublicacao() {
  return (
    <>
      <Link href="/" className="text-sm text-texto-suave hover:text-verde-medio">
        ← Voltar às publicações
      </Link>
      <h1 className="mb-8 mt-2 font-titulo text-4xl text-verde-escuro">Nova publicação</h1>
      <PostForm />
    </>
  );
}
