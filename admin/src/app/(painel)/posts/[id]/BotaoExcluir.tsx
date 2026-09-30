"use client";

export function BotaoExcluir() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm("Excluir esta publicação? As fotos também serão apagadas. Esta ação não pode ser desfeita.")) {
          e.preventDefault();
        }
      }}
      className="text-sm font-bold text-vinho underline-offset-4 hover:underline"
    >
      Excluir publicação
    </button>
  );
}
