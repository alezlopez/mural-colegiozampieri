import { Webhook } from "standardwebhooks";
import { enviarCodigoWhatsApp } from "@/lib/whatsapp";

// "Send SMS Hook" do Supabase Auth: o Supabase gera o código (validade, limite de tentativas)
// e chama esta rota para entregá-lo. Aqui a entrega é por WhatsApp.
type Payload = { user: { phone: string }; sms: { otp: string } };

function erro(status: number, mensagem: string) {
  return Response.json({ error: { http_code: status, message: mensagem } }, { status });
}

export async function POST(request: Request) {
  const segredo = process.env.SUPABASE_AUTH_HOOK_SEND_SMS_SECRET;
  if (!segredo) return erro(500, "Gancho de envio não configurado");

  const corpo = await request.text();
  let payload: Payload;
  try {
    const webhook = new Webhook(segredo.replace(/^v1,whsec_/, ""));
    payload = webhook.verify(corpo, Object.fromEntries(request.headers)) as Payload;
  } catch {
    return erro(401, "Assinatura inválida");
  }

  try {
    await enviarCodigoWhatsApp(payload.user.phone, payload.sms.otp);
  } catch (e) {
    console.error("[enviar-codigo]", e);
    return erro(502, "Não foi possível enviar o código pelo WhatsApp");
  }
  return Response.json({});
}
