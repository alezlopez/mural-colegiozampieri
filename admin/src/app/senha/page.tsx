import Image from "next/image";
import { carregarEquipe } from "@/lib/auth";
import { FormSenha } from "../professor/senha/FormSenha";
import { trocarSenhaEquipe } from "./actions";

// Primeiro acesso de quem a direção cadastrou em Equipe (fica fora do layout do painel, que exige a troca).
export default async function PaginaSenhaEquipe() {
  const { nome } = await carregarEquipe();
  return (
    <main className="flex min-h-screen items-center justify-center bg-branco-quente p-6">
      <div className="w-full max-w-sm">
        <Image src="/brasao.png" alt="" width={48} height={59} className="mb-4" />
        <h1 className="font-titulo text-2xl text-verde-escuro">Olá, {nome.split(" ")[0]}!</h1>
        <p className="mb-6 mt-1 text-sm text-texto-suave">
          Crie a sua senha para acessar o painel. Use pelo menos 8 caracteres; a senha provisória deixa de valer.
        </p>
        <FormSenha trocarSenha={trocarSenhaEquipe} />
      </div>
    </main>
  );
}
