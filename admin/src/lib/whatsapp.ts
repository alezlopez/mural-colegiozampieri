import "server-only";

/**
 * Entrega do código de verificação por WhatsApp.
 *
 * WHATSAPP_PROVEDOR:
 *  - "meta":    WhatsApp Cloud API oficial, com template de autenticação aprovado na Meta.
 *  - "webhook": POST JSON { telefone, codigo, mensagem } para WHATSAPP_WEBHOOK_URL,
 *               com o header "Authorization: <WHATSAPP_TOKEN>" (token puro)
 *               (para APIs próprias / Z-API / Evolution etc. — adapte aqui se o formato for outro).
 *  - "log":     só imprime no console. Apenas desenvolvimento; bloqueado em produção.
 */
export async function enviarCodigoWhatsApp(telefone: string, codigo: string) {
  const provedor = process.env.WHATSAPP_PROVEDOR ?? "log";
  const mensagem = `Seu código de acesso ao app do Colégio Zampieri é ${codigo}. Não compartilhe com ninguém.`;

  if (provedor === "meta") {
    const versao = process.env.WHATSAPP_GRAPH_VERSAO ?? "v21.0";
    const resp = await fetch(
      `https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefone,
          type: "template",
          template: {
            name: process.env.WHATSAPP_TEMPLATE ?? "codigo_acesso",
            language: { code: "pt_BR" },
            components: [
              { type: "body", parameters: [{ type: "text", text: codigo }] },
              // Templates de autenticação têm botão "copiar código", que também recebe o código.
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: codigo }] },
            ],
          },
        }),
      },
    );
    if (!resp.ok) throw new Error(`WhatsApp Cloud API respondeu ${resp.status}: ${await resp.text()}`);
    return;
  }

  if (provedor === "webhook") {
    const url = process.env.WHATSAPP_WEBHOOK_URL;
    if (!url) throw new Error("WHATSAPP_WEBHOOK_URL não configurada");
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // O Header Auth do n8n compara o valor exato: envia o token puro, sem "Bearer".
        ...(process.env.WHATSAPP_TOKEN ? { Authorization: process.env.WHATSAPP_TOKEN } : {}),
      },
      body: JSON.stringify({ telefone, codigo, mensagem }),
    });
    if (!resp.ok) throw new Error(`API de WhatsApp respondeu ${resp.status}: ${await resp.text()}`);
    return;
  }

  if (process.env.NODE_ENV === "production" && process.env.WHATSAPP_PERMITIR_LOG !== "1") {
    throw new Error("WHATSAPP_PROVEDOR não configurado em produção");
  }
  console.info(`[whatsapp:log] código para ${telefone}: ${codigo}`);
}
