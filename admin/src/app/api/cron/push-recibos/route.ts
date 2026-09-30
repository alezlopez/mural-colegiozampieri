import { verificarRecibos } from "@/lib/push";

// Chamado pelo agendador (vercel.json) com Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const resultado = await verificarRecibos();
  return Response.json(resultado);
}
