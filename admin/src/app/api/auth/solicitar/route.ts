import { criarClienteServico } from "@/lib/supabase/servico";
import { normalizarCpf } from "@/lib/cpf";
import { normalizarTelefone } from "@/lib/telefone";

// Primeiro passo do login do responsável no app:
// confere se o código do aluno (ou o CPF do responsável financeiro) pertence a um aluno ativo
// com aquele telefone cadastrado
// e garante que o usuário existe no Supabase Auth. O app então pede o código (signInWithOtp).

const JANELA_MIN = 15;
const MAX_FALHAS_TELEFONE = 5;
const MAX_FALHAS_IP = 20;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function resposta(corpo: object, status = 200) {
  return Response.json(corpo, { status, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  let dados: { codigo_aluno?: unknown; telefone?: unknown };
  try {
    dados = await request.json();
  } catch {
    return resposta({ erro: "Requisição inválida." }, 400);
  }

  const codigo = typeof dados.codigo_aluno === "string" ? dados.codigo_aluno.trim() : "";
  const telefone = typeof dados.telefone === "string" ? normalizarTelefone(dados.telefone) : null;
  if (!codigo || codigo.length > 40) return resposta({ erro: "Informe o código do aluno ou o CPF." }, 400);
  // O mesmo campo aceita CPF: 11 dígitos (com ou sem pontuação) e dígitos verificadores válidos.
  const cpf = /^[\d.\-\s]+$/.test(codigo) ? normalizarCpf(codigo) : null;
  if (!telefone) return resposta({ erro: "Informe um celular válido com DDD." }, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const db = criarClienteServico();
  const desde = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString();

  const [porTelefone, porIp] = await Promise.all([
    db.from("login_tentativas").select("id", { count: "exact", head: true })
      .eq("telefone", telefone).eq("sucesso", false).gte("created_at", desde),
    ip
      ? db.from("login_tentativas").select("id", { count: "exact", head: true })
          .eq("ip", ip).eq("sucesso", false).gte("created_at", desde)
      : Promise.resolve({ count: 0 }),
  ]);
  if ((porTelefone.count ?? 0) >= MAX_FALHAS_TELEFONE || (porIp.count ?? 0) >= MAX_FALHAS_IP) {
    return resposta({ erro: `Muitas tentativas. Aguarde ${JANELA_MIN} minutos e tente de novo.` }, 429);
  }

  const consulta = db
    .from("aluno_responsaveis")
    .select("aluno_codigo, alunos!inner(ativo)")
    .eq("telefone", telefone)
    .eq("alunos.ativo", true);
  // Pelo CPF podem vir vários filhos: basta um vínculo ativo.
  const { data: vinculos, error } = await (cpf ? consulta.eq("cpf", cpf) : consulta.eq("aluno_codigo", codigo)).limit(1);
  const vinculo = vinculos?.[0];
  if (error) {
    console.error("[solicitar]", error);
    return resposta({ erro: "Erro ao validar os dados. Tente novamente." }, 500);
  }

  await db.from("login_tentativas").insert({ telefone, ip, sucesso: Boolean(vinculo) });

  if (!vinculo) {
    return resposta(
      { erro: "Código do aluno (ou CPF) e telefone não conferem com o cadastro da escola. Procure a secretaria se precisar atualizar." },
      404,
    );
  }

  // Cria o usuário na primeira vez (cadastro público fica desligado no Supabase).
  const { error: erroCriar } = await db.auth.admin.createUser({ phone: telefone, phone_confirm: true });
  if (erroCriar && erroCriar.code !== "phone_exists") {
    console.error("[solicitar] createUser", erroCriar);
    return resposta({ erro: "Erro ao preparar o acesso. Tente novamente." }, 500);
  }

  return resposta({ ok: true, telefone: `+${telefone}` });
}
