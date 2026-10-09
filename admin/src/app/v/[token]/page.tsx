import Image from "next/image";
import type { Metadata } from "next";
import { BUCKET_FOTOS_ALUNOS } from "@/lib/fotos";
import { criarClienteServico } from "@/lib/supabase/servico";

// Página aberta ao escanear o QR da carteirinha digital (pública: quem escaneia não tem login).
// A conferência da assinatura do código acontece no banco (validar_carteirinha), que também registra a leitura.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Carteirinha · Colégio Zampieri", robots: { index: false, follow: false } };

type Resultado = {
  valido: boolean;
  motivo: string | null;
  nome: string | null;
  turma: string | null;
  codigo: string | null;
  ano_letivo: number | null;
};

const MENSAGENS: Record<string, string> = {
  expirado: "Este código expirou. Peça para abrir a carteirinha no app de novo: o código muda a cada 30 segundos.",
  inativo: "Aluno sem matrícula ativa no Colégio Zampieri.",
  invalido: "Código não reconhecido. Pode ser uma imagem copiada ou adulterada.",
};

export default async function PaginaValidacao({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  let resultado: Resultado | null = null;
  let fotoUrl: string | null = null;
  try {
    const db = criarClienteServico();
    const { data, error } = await db.rpc("validar_carteirinha", { p_token: decodeURIComponent(token).slice(0, 200) });
    if (error) throw error;
    resultado = (data as Resultado[])[0] ?? null;

    // Foto aprovada, com link que expira em 2 minutos (foto de criança nunca fica em endereço fixo).
    if (resultado?.valido && resultado.codigo) {
      const { data: foto } = await db
        .from("aluno_fotos")
        .select("caminho")
        .eq("aluno_codigo", resultado.codigo)
        .eq("status", "aprovada")
        .maybeSingle();
      if (foto) {
        const { data: assinada } = await db.storage.from(BUCKET_FOTOS_ALUNOS).createSignedUrl(foto.caminho, 120);
        fotoUrl = assinada?.signedUrl ?? null;
      }
    }
  } catch (e) {
    console.error("[carteirinha] validação", e);
  }

  const valido = resultado?.valido === true;
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-branco-quente p-5">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-borda bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-verde-escuro px-5 py-4 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
            <Image src="/brasao.png" alt="" width={28} height={34} />
          </div>
          <div>
            <p className="font-titulo text-lg leading-tight">Colégio Zampieri</p>
            <p className="text-[10px] font-bold tracking-[0.2em] text-dourado-claro">CARTEIRINHA DO ALUNO</p>
          </div>
        </div>
        <div className="tricolor h-1" />

        <div className="space-y-4 px-5 py-6">
          {valido ? (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-verde-claro text-2xl text-white">✓</span>
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-verde-claro">ALUNO MATRICULADO</p>
                  <p className="text-sm text-texto-suave">Ano letivo {resultado?.ano_letivo}</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-lg bg-creme px-4 py-3">
                {fotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do Supabase
                  <img src={fotoUrl} alt={`Foto de ${resultado?.nome}`} className="h-32 w-24 shrink-0 rounded-md object-cover" />
                )}
                <div>
                  <p className="font-titulo text-2xl leading-snug text-verde-escuro">{resultado?.nome}</p>
                  <p className="mt-1 text-sm text-texto">{resultado?.turma}</p>
                  <p className="text-sm text-texto-suave">Código {resultado?.codigo}</p>
                </div>
              </div>
              <p className="text-xs text-texto-suave">
                {fotoUrl
                  ? "Confira se a foto corresponde a quem apresenta a carteirinha."
                  : "Carteirinha sem foto aprovada: confira com um documento com foto, se necessário."}{" "}
                Esta carteirinha identifica o aluno; não substitui a Carteira de Identificação Estudantil (CIE) exigida
                para meia-entrada.
              </p>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vinho text-2xl text-white">✕</span>
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-vinho">NÃO VALIDADA</p>
                <p className="mt-1 text-sm text-texto">
                  {resultado
                    ? MENSAGENS[resultado.motivo ?? "invalido"] ?? MENSAGENS.invalido
                    : "Não foi possível consultar agora. Tente de novo em instantes."}
                </p>
              </div>
            </div>
          )}
          <p className="border-t border-borda pt-3 text-[11px] text-texto-suave">Consultado em {agora}</p>
        </div>
      </div>
    </main>
  );
}
