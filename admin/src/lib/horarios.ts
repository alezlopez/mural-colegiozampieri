export const DIAS_SEMANA = [
  { numero: 1, curto: "Seg", nome: "Segunda" },
  { numero: 2, curto: "Ter", nome: "Terça" },
  { numero: 3, curto: "Qua", nome: "Quarta" },
  { numero: 4, curto: "Qui", nome: "Quinta" },
  { numero: 5, curto: "Sex", nome: "Sexta" },
];

export type AulaModelo = { modelo_id: number; numero: number; inicio: string; fim: string };
export type SlotHorario = { turma_id: number; dia_semana: number; aula_numero: number; disciplina_id: number };

/** "07:15:00" → 435 */
export function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export const hhmm = (hora: string) => hora.slice(0, 5);

/**
 * Professor em duas turmas ao mesmo tempo: compara os horários reais (turmas podem ter modelos diferentes),
 * não só o número da aula. Devolve um aviso por par de aulas que se sobrepõem.
 */
export function conflitosDeProfessor(
  slots: SlotHorario[],
  professorDe: (turma: number, disciplina: number) => number | null | undefined,
  modeloDa: (turma: number) => number | null | undefined,
  aulas: AulaModelo[],
) {
  const hora = new Map(aulas.map((a) => [`${a.modelo_id}:${a.numero}`, a]));
  const porProfessorDia = new Map<string, { slot: SlotHorario; ini: number; fim: number }[]>();
  for (const s of slots) {
    const prof = professorDe(s.turma_id, s.disciplina_id);
    const h = hora.get(`${modeloDa(s.turma_id)}:${s.aula_numero}`);
    if (!prof || !h) continue;
    const chave = `${prof}:${s.dia_semana}`;
    const lista = porProfessorDia.get(chave) ?? [];
    lista.push({ slot: s, ini: minutos(h.inicio), fim: minutos(h.fim) });
    porProfessorDia.set(chave, lista);
  }
  const conflitos: { professor: number; a: SlotHorario; b: SlotHorario }[] = [];
  for (const [chave, lista] of porProfessorDia) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const x = lista[i];
        const y = lista[j];
        if (x.slot.turma_id !== y.slot.turma_id && x.ini < y.fim && y.ini < x.fim) {
          conflitos.push({ professor: Number(chave.split(":")[0]), a: x.slot, b: y.slot });
        }
      }
    }
  }
  return conflitos;
}
