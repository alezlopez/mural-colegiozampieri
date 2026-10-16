import { exigirArea } from "@/lib/auth";
import { MODELOS } from "@/lib/importacao-csv";
import { FormImportacao } from "./FormImportacao";

export default async function Importacao() {
  await exigirArea("secretaria", "editar");
  return (
    <div className="max-w-3xl">
      <h1 className="font-titulo text-3xl text-verde-escuro">Importar CSV</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Completa o cadastro com os dados que a Mhund não envia pela integração (CPF, RG, endereço, naturalidade…). Só preenche
        campos <strong>vazios</strong>: o que a secretaria já digitou no painel não muda. Confira antes de importar.
      </p>

      <section className="mt-6">
        <h2 className="rotulo">Modelos</h2>
        <ul className="mt-2 space-y-3">
          {Object.entries(MODELOS).map(([tipo, m]) => (
            <li key={tipo} className="rounded-xl border border-borda bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="flex-1 text-verde-escuro">{m.titulo}</strong>
                <a href={`/importacao/modelo?tipo=${tipo}`} className="botao-secundario !px-3 !py-1.5">
                  Baixar modelo
                </a>
              </div>
              <p className="mt-2 break-words font-mono text-xs text-texto-suave">{m.colunas.join(";")}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-texto-suave">
          <li>Use exatamente esses nomes de coluna na 1ª linha. A ordem não importa; coluna que faltar é ignorada.</li>
          <li>Separador ponto e vírgula (;). Codificação UTF-8 ou a padrão do Excel; as duas funcionam.</li>
          <li>
            Alunos: <code>codigo_aluno</code> é o mesmo código do painel (id do aluno na Mhund) e é obrigatório. Responsáveis:{" "}
            <code>id_responsavel</code> (id na Mhund) ou <code>cpf</code>.
          </li>
          <li>CPF e CEP com ou sem pontuação; datas em dd/mm/aaaa; sexo M ou F; UF com 2 letras; célula vazia = não mexe.</li>
          <li>Apague a linha de exemplo do modelo antes de importar (se ficar, ela aparece como “não encontrado” e é ignorada).</li>
          <li>Responsáveis: rode depois da sincronização noturna, que cria pais e mães a partir da Mhund.</li>
        </ul>
      </section>

      <section className="mt-6">
        <FormImportacao tipos={Object.entries(MODELOS).map(([k, m]) => [k, m.titulo])} />
      </section>
    </div>
  );
}
