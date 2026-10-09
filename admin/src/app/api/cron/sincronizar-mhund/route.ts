import { sincronizarMhund } from "@/lib/sincronizacao-mhund";
import { criarClienteServico } from "@/lib/supabase/servico";

// Chamado pelo n8n (agendado, 1x por dia) com Authorization: Bearer <CRON_SECRET>.
// ?simular=1 só calcula e devolve o que mudaria, sem gravar. ?ano=2027 sincroniza outro ano letivo.
// ?desde=AAAA-MM-DD sincroniza só o que mudou desde a data (de dia, a Mhund aceita no máximo 30 dias).
// Sem "desde": coleta completa, que a Mhund só libera entre 18h e 8h (agendar de madrugada).
export const maxDuration = 300;

export async function POST(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const url = new URL(request.url);
  const ano = Number(url.searchParams.get("ano") ?? new Date().getFullYear());
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return Response.json({ erro: "Ano inválido." }, { status: 400 });

  try {
    const desdeBruto = url.searchParams.get("desde");
    if (desdeBruto && !/^\d{4}-\d{2}-\d{2}$/.test(desdeBruto)) return Response.json({ erro: "Data inválida." }, { status: 400 });
    const resumo = await sincronizarMhund(criarClienteServico(), ano, {
      simular: url.searchParams.get("simular") === "1",
      ...(desdeBruto ? { desde: `${desdeBruto}T00:00:00` } : {}),
    });
    return Response.json(resumo);
  } catch (e) {
    console.error("[sincronizar-mhund]", e);
    return Response.json({ erro: e instanceof Error ? e.message : "Falha na sincronização." }, { status: 502 });
  }
}
