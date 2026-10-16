import { exigirArea } from "@/lib/auth";
import { MODELOS, modeloCsv, type TipoImportacao } from "@/lib/importacao-csv";

export async function GET(request: Request) {
  await exigirArea("secretaria");
  const tipo = new URL(request.url).searchParams.get("tipo") ?? "";
  if (!(tipo in MODELOS)) return new Response("Modelo inválido", { status: 400 });
  return new Response(modeloCsv(tipo as TipoImportacao), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modelo-${tipo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
