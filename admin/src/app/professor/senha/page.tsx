import { exigirProfessor } from "@/lib/auth";
import { FormSenha } from "./FormSenha";

export default async function PaginaSenha() {
  const { professor } = await exigirProfessor({ permitirTrocaPendente: true });
  return (
    <div className="mx-auto max-w-sm py-4">
      <h1 className="font-titulo text-2xl text-verde-escuro">Olá, {professor.nome.split(" ")[0]}!</h1>
      <p className="mb-6 mt-1 text-sm text-texto-suave">
        Crie a sua senha para acessar o diário. Use pelo menos 8 caracteres; a senha provisória deixa de valer.
      </p>
      <FormSenha />
    </div>
  );
}
