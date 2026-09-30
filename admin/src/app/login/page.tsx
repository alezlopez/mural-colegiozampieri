import Image from "next/image";
import { FormLogin } from "./FormLogin";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;

  return (
    <main className="flex min-h-screen flex-1">
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-verde-escuro p-12 text-white lg:flex">
        <div className="absolute inset-y-0 right-16 w-1 rotate-6 bg-dourado" aria-hidden />
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <Image src="/brasao.png" alt="" width={42} height={52} />
          </div>
          <div>
            <p className="font-titulo text-2xl">Colégio Zampieri</p>
            <p className="text-xs font-bold tracking-[0.2em] text-dourado-claro">TRADIÇÃO EM EDUCAÇÃO · DESDE 1980</p>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[0.25em] text-dourado-claro">PAINEL DO MURAL</p>
          <h1 className="font-titulo text-6xl leading-tight">
            Tradição em <em className="text-dourado-claro">Educação</em>
          </h1>
          <p className="mt-4 max-w-md text-lg font-light text-creme/80">
            Publique comunicados, avisos, lembretes e fotos para toda a comunidade escolar.
          </p>
        </div>
        <p className="font-titulo text-7xl text-white/10">1980</p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-branco-quente p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Image src="/brasao.png" alt="Brasão do Colégio Zampieri" width={64} height={78} />
            <p className="mt-3 font-titulo text-2xl text-verde-escuro">Colégio Zampieri</p>
          </div>
          <h2 className="font-titulo text-3xl text-verde-escuro">Entrar</h2>
          <p className="mb-6 mt-1 text-sm text-texto-suave">Acesso restrito à equipe da escola.</p>
          {erro === "sem-permissao" && (
            <p className="mb-4 rounded-md border border-vinho/30 bg-vinho/5 px-3 py-2 text-sm text-vinho">
              Sua conta não tem permissão de administrador.
            </p>
          )}
          <FormLogin />
        </div>
      </section>
    </main>
  );
}
