export type Categoria = "comunicado" | "aviso" | "lembrete" | "evento" | "galeria";

export const CATEGORIAS: Record<Categoria, { rotulo: string; descricao: string; classe: string }> = {
  comunicado: { rotulo: "Comunicado", descricao: "Informação oficial da escola", classe: "bg-verde-medio" },
  aviso: { rotulo: "Aviso", descricao: "Algo importante ou urgente", classe: "bg-vinho" },
  lembrete: { rotulo: "Lembrete", descricao: "Prazos, materiais, datas", classe: "bg-dourado" },
  evento: { rotulo: "Evento", descricao: "Festas, reuniões, passeios", classe: "bg-verde-claro" },
  galeria: { rotulo: "Fotos", descricao: "Álbum de fotos", classe: "bg-verde-escuro" },
};

export const ORDEM_CATEGORIAS: Categoria[] = ["comunicado", "aviso", "lembrete", "evento", "galeria"];

export function ehCategoria(valor: unknown): valor is Categoria {
  return typeof valor === "string" && valor in CATEGORIAS;
}
