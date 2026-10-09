import { sincronizarMhund } from "@/lib/sincronizacao-mhund";
import { criarClienteServico } from "@/lib/supabase/servico";

// Chamado pelo n8n (agendado, 1x por dia) com Authorization: Bearer <CRON_SECRET>.
// ?simular=1 só calcula e devolve o que mudaria, sem gravar. ?ano=2027 sincroniza outro ano letivo.
// ?desde=AAAA-MM-DD sincroniza só o que mudou desde a data (de dia, a Mhund aceita no máximo 30 dias).
// Por padrão grava só alunos e responsável financeiro; ?pedagogico=1 também turmas, disciplinas, professores, grade e
// matrículas (desligado: o pedagógico de 2027 é montado no painel).
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
      pedagogico: url.searchParams.get("pedagogico") === "1",
      ...(desdeBruto ? { desde: `${desdeBruto}T00:00:00` } : {}),
    });
    return Response.json(resumo);
  } catch (e) {
    console.error("[sincronizar-mhund]", e);
    const mensagem = e instanceof Error ? e.message : "Falha na sincronização.";
    const foraDoHorario = /18h às 8h|grande volume/i.test(mensagem);
    // 424 (e não 502): o proxy do Easypanel troca respostas 502 pela própria página de erro e esconde a mensagem.
    return Response.json(
      {
        erro: foraDoHorario
          ? "A Mhund só libera a carga completa entre 18h e 8h. Rode à noite, ou use ?desde=AAAA-MM-DD (até 30 dias atrás) para testar de dia."
          : mensagem,
      },
      { status: 424 },
    );
  }
}
