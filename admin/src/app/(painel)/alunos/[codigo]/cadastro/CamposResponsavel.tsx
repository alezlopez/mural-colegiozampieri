import { formatarCpf } from "@/lib/cpf";

export const ESTADOS_CIVIS = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  separado: "Separado(a)",
  viuvo: "Viúvo(a)",
} as const;
export const PARENTESCOS = { pai: "Pai", mae: "Mãe", outro: "Outro" } as const;

export type Responsavel = {
  id: number;
  cpf: string | null;
  rg: string | null;
  nome: string;
  nome_social: string | null;
  nascimento: string | null;
  naturalidade: string | null;
  nacionalidade: string;
  estado_civil: keyof typeof ESTADOS_CIVIS | null;
  celular: string | null;
  email: string | null;
};
export type Vinculo = { parentesco: keyof typeof PARENTESCOS; parentesco_descricao: string | null; financeiro: boolean; acesso_app: boolean };

/** Campos do pai/mãe/responsável e do vínculo com o aluno (novo ou edição). */
export function CamposResponsavel({ r, v }: { r?: Responsavel; v?: Vinculo }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="rotulo">É</span>
          <select name="parentesco" defaultValue={v?.parentesco ?? "mae"} className="campo">
            {Object.entries(PARENTESCOS).map(([k, rot]) => (
              <option key={k} value={k}>
                {rot}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="rotulo">Se outro, qual (avó, tio, tutor legal…)</span>
          <input name="parentesco_descricao" defaultValue={v?.parentesco_descricao ?? ""} className="campo" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="rotulo">Nome completo</span>
          <input name="nome" defaultValue={r?.nome ?? ""} required minLength={3} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Nome social (quando houver)</span>
          <input name="nome_social" defaultValue={r?.nome_social ?? ""} className="campo" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="rotulo">CPF</span>
          <input name="cpf" defaultValue={r?.cpf ? formatarCpf(r.cpf) : ""} inputMode="numeric" placeholder="000.000.000-00" className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">RG</span>
          <input name="rg" defaultValue={r?.rg ?? ""} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Nascimento</span>
          <input name="nascimento" type="date" defaultValue={r?.nascimento ?? ""} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Estado civil</span>
          <select name="estado_civil" defaultValue={r?.estado_civil ?? ""} className="campo">
            <option value="">—</option>
            {Object.entries(ESTADOS_CIVIS).map(([k, rot]) => (
              <option key={k} value={k}>
                {rot}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="rotulo">Naturalidade (cidade/UF)</span>
          <input name="naturalidade" defaultValue={r?.naturalidade ?? ""} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Nacionalidade</span>
          <input name="nacionalidade" defaultValue={r?.nacionalidade ?? "Brasileira"} className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Celular (DDD + número)</span>
          <input
            name="celular"
            defaultValue={r?.celular ? r.celular.replace(/^55/, "") : ""}
            inputMode="numeric"
            placeholder="11996525783"
            className="campo"
          />
        </label>
        <label className="block">
          <span className="rotulo">E-mail</span>
          <input name="email" type="email" defaultValue={r?.email ?? ""} className="campo" />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="financeiro" defaultChecked={v?.financeiro ?? false} />
          Responsável financeiro (telefone e e-mail do aluno)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="acesso_app" defaultChecked={v?.acesso_app ?? true} />
          Acesso ao app pelo celular
        </label>
      </div>
    </div>
  );
}
