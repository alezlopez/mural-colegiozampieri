import { criarClienteServico } from "@/lib/supabase/servico";

// Exclusão da conta do responsável pelo próprio app (exigência das lojas).
// Apaga o login e os identificadores de notificação; os registros escolares do aluno ficam (obrigação legal).
// Conta da equipe ou de professor não se exclui por aqui.
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  const db = criarClienteServico();
  const { data, error } = await db.auth.getUser(token);
  const usuario = data?.user;
  if (error || !usuario) return Response.json({ erro: "Sessão expirada. Entre de novo e tente outra vez." }, { status: 401 });

  const [{ data: admin }, { data: professor }] = await Promise.all([
    db.from("admins").select("user_id").eq("user_id", usuario.id).maybeSingle(),
    db.from("professores").select("id").eq("user_id", usuario.id).maybeSingle(),
  ]);
  if (admin || professor) {
    return Response.json({ erro: "Contas da equipe e de professores são encerradas pela secretaria." }, { status: 403 });
  }

  const { error: erroTokens } = await db.from("push_tokens").delete().eq("user_id", usuario.id);
  if (erroTokens) console.error("[conta] tokens", erroTokens);

  const { error: erroExclusao } = await db.auth.admin.deleteUser(usuario.id);
  if (erroExclusao) {
    console.error("[conta] excluir", erroExclusao);
    return Response.json({ erro: "Não foi possível excluir a conta agora. Tente de novo mais tarde." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
