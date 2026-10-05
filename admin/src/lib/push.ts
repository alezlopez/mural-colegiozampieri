import "server-only";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { CATEGORIAS, type Categoria } from "./categorias";
import { criarClienteServico } from "./supabase/servico";

// Mesmo canal criado pelo app no Android (app/src/lib/push.ts).
const CANAL_ANDROID = "mural";

function clienteExpo() {
  return new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });
}

function resumo(texto: string, limite = 140) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
}

type PostParaPush = { id: string; categoria: Categoria; titulo: string; corpo: string; turmas: string[] | null };

export type ResultadoPush = { dispositivos: number; enviados: number; falhas: number };

/** Envia a notificação de uma publicação para todos os dispositivos ativos. */
export async function enviarPushDoPost(post: PostParaPush): Promise<ResultadoPush> {
  const db = criarClienteServico();
  const expo = clienteExpo();

  // Público → todos os aparelhos; por turma → só responsáveis logados com filhos nessas turmas.
  // O PostgREST limita cada resposta (1000 linhas por padrão): busca em páginas.
  const tokens: string[] = [];
  const PAGINA = 1000;
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .rpc("tokens_para_publicacao", { p_turmas: post.turmas })
      .order("token")
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`Erro ao ler dispositivos: ${error.message}`);
    const lote = (data as { token: string }[]).map((l) => l.token);
    tokens.push(...lote.filter((t) => Expo.isExpoPushToken(t)));
    if (lote.length < PAGINA) break;
  }

  const rotulo = CATEGORIAS[post.categoria].rotulo;
  const mensagens: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    title: `${rotulo} · ${post.titulo}`,
    body: resumo(post.corpo) || "Nova publicação no mural do Colégio Zampieri",
    data: { url: `/post/${post.id}` },
    sound: "default",
    channelId: CANAL_ANDROID,
    priority: "high",
  }));

  const tickets: { token: string; ticket: ExpoPushTicket }[] = [];
  for (const lote of expo.chunkPushNotifications(mensagens)) {
    try {
      const resposta = await expo.sendPushNotificationsAsync(lote);
      resposta.forEach((ticket, i) => tickets.push({ token: lote[i].to as string, ticket }));
    } catch (e) {
      // Falha do lote inteiro (rede, credenciais): segue com os demais lotes.
      console.error("[push] falha ao enviar lote", e);
    }
  }

  const aDesativar = tickets
    .filter(({ ticket }) => ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered")
    .map(({ token }) => token);
  if (aDesativar.length > 0) {
    await db.from("push_tokens").update({ desativado_em: new Date().toISOString() }).in("token", aDesativar);
  }

  const aVerificar = tickets.flatMap(({ token, ticket }) =>
    ticket.status === "ok" ? [{ ticket_id: ticket.id, token, post_id: post.id }] : [],
  );
  for (let i = 0; i < aVerificar.length; i += 500) {
    await db.from("push_tickets").insert(aVerificar.slice(i, i + 500));
  }

  await db
    .from("posts")
    .update({ push_enviado_em: new Date().toISOString(), push_dispositivos: aVerificar.length })
    .eq("id", post.id);

  return {
    dispositivos: tokens.length,
    enviados: aVerificar.length,
    falhas: tokens.length - aVerificar.length,
  };
}

/**
 * Consulta os recibos (recomendação do Expo: ~15 min após o envio) e desativa
 * tokens de aparelhos que desinstalaram o app ou revogaram a permissão.
 */
export async function verificarRecibos() {
  const db = criarClienteServico();
  const expo = clienteExpo();
  const limite = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("push_tickets")
    .select("ticket_id, token")
    .lt("created_at", limite)
    .limit(5000);
  if (error) throw new Error(error.message);
  if (data.length === 0) return { verificados: 0, desativados: 0 };

  const tokenDoTicket = new Map(data.map((l) => [l.ticket_id as string, l.token as string]));
  const desativar = new Set<string>();
  const processados: string[] = [];

  for (const lote of expo.chunkPushNotificationReceiptIds([...tokenDoTicket.keys()])) {
    try {
      const recibos = await expo.getPushNotificationReceiptsAsync(lote);
      for (const id of lote) {
        const recibo = recibos[id];
        if (recibo?.status === "error" && recibo.details?.error === "DeviceNotRegistered") {
          desativar.add(tokenDoTicket.get(id)!);
        }
      }
      processados.push(...lote);
    } catch (e) {
      console.error("[push] falha ao buscar recibos", e);
    }
  }

  if (desativar.size > 0) {
    await db.from("push_tokens").update({ desativado_em: new Date().toISOString() }).in("token", [...desativar]);
  }
  // Recibos expiram em 24h no Expo; tickets processados (ou muito antigos) saem da fila.
  for (let i = 0; i < processados.length; i += 500) {
    await db.from("push_tickets").delete().in("ticket_id", processados.slice(i, i + 500));
  }
  await db
    .from("push_tickets")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return { verificados: processados.length, desativados: desativar.size };
}
