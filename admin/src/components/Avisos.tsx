/** Mensagens de retorno das ações do painel (vêm na URL como ?salvo= ou ?erro=). */
export function Avisos({ salvo, erro }: { salvo: string | null; erro: string | null }) {
  return (
    <>
      {salvo && (
        <p role="status" className="mt-3 rounded-md border border-verde-claro/30 bg-verde-claro/10 px-3 py-2 text-sm text-verde-escuro">
          {salvo}
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-3 rounded-md border border-vinho/30 bg-vinho/5 px-3 py-2 text-sm text-vinho">
          {erro}
        </p>
      )}
    </>
  );
}
