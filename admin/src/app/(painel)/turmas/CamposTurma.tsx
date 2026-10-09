import { SEGMENTOS, TURNOS } from "@/lib/segmentos";

type Turma = {
  nome: string;
  ano: number;
  segmento: string;
  turno: string | null;
  serie: string | null;
  letra: string | null;
  modelo_horario_id: number | null;
};

/** Campos do cadastro de turma (novo e edição). */
export function CamposTurma({ turma, ano, modelos }: { turma?: Turma; ano: number; modelos: { id: number; nome: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <label className="block sm:col-span-4">
        <span className="rotulo">Nome da turma</span>
        <input name="nome" defaultValue={turma?.nome} required maxLength={120} placeholder="Ensino Fundamental I - 1º Ano A" className="campo" />
      </label>
      <label className="block sm:col-span-2">
        <span className="rotulo">Ano letivo</span>
        <input name="ano" type="number" min={2020} max={2100} defaultValue={turma?.ano ?? ano} required className="campo" />
      </label>
      <label className="block sm:col-span-2">
        <span className="rotulo">Segmento</span>
        <select name="segmento" defaultValue={turma?.segmento ?? ""} required className="campo">
          <option value="" disabled>
            Escolha…
          </option>
          {Object.entries(SEGMENTOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="rotulo">Série</span>
        <input name="serie" defaultValue={turma?.serie ?? ""} maxLength={60} placeholder="1º Ano" className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">Turma</span>
        <input name="letra" defaultValue={turma?.letra ?? ""} maxLength={4} placeholder="A" className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">Turno</span>
        <select name="turno" defaultValue={turma?.turno ?? ""} className="campo">
          <option value="">—</option>
          {Object.entries(TURNOS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-3">
        <span className="rotulo">Modelo de horário</span>
        <select name="modelo_horario_id" defaultValue={turma?.modelo_horario_id ?? ""} className="campo">
          <option value="">Escolher depois</option>
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
