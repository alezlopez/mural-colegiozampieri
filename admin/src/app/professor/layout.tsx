import Image from "next/image";
import Link from "next/link";
import { sair } from "../login/actions";

// Área do professor: pensada para o celular (lançar a aula na sala) e funciona no computador.
export default function LayoutProfessor({ children }: LayoutProps<"/professor">) {
  return (
    <div className="flex min-h-screen flex-col bg-branco-quente">
      <header className="bg-verde-escuro text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/professor" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <Image src="/brasao.png" alt="" width={23} height={28} />
            </span>
            <span>
              <span className="block font-titulo text-base leading-tight">Colégio Zampieri</span>
              <span className="block text-[10px] font-bold tracking-[0.2em] text-dourado-claro">DIÁRIO DO PROFESSOR</span>
            </span>
          </Link>
          <form action={sair} className="ml-auto">
            <button className="text-sm text-creme/80 underline-offset-4 hover:text-white hover:underline">Sair</button>
          </form>
        </div>
        <div className="tricolor h-1" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
