import Image from "next/image";
import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { sair } from "../login/actions";

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  const { nome } = await exigirAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-verde-escuro text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <Image src="/brasao.png" alt="" width={29} height={36} />
            </span>
            <span>
              <span className="block font-titulo text-xl leading-tight">Colégio Zampieri</span>
              <span className="block text-[10px] font-bold tracking-[0.2em] text-dourado-claro">PAINEL DO MURAL</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden text-creme/80 sm:inline">Olá, {nome}</span>
            <form action={sair}>
              <button className="text-creme/80 underline-offset-4 hover:text-white hover:underline">Sair</button>
            </form>
          </div>
        </div>
        <div className="tricolor h-1" />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-borda py-6 text-center text-xs tracking-[0.15em] text-texto-suave">
        COLÉGIO ZAMPIERI · TRADIÇÃO EM EDUCAÇÃO
      </footer>
    </div>
  );
}
