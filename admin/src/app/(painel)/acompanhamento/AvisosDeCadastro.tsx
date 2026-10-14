import Link from "next/link";

/** O que falta cadastrar para os números do acompanhamento fazerem sentido. */
export function AvisosDeCadastro({ ano, temAnoLetivo, temBimestres, semHorario }: { ano: number; temAnoLetivo: boolean; temBimestres: boolean; semHorario: boolean }) {
  const faltas = [
    !temAnoLetivo && "o início e o fim do ano letivo",
    !temBimestres && "os bimestres",
    semHorario && "os horários das turmas",
  ].filter(Boolean);
  if (faltas.length === 0) return null;
  return (
    <p className="mt-4 rounded-md border border-dourado/40 bg-dourado/10 px-3 py-2 text-sm text-texto">
      Para calcular as aulas previstas de {ano}, cadastre {faltas.join(", ")} em{" "}
      <Link href={semHorario && temAnoLetivo ? "/horarios" : `/calendario?ano=${ano}`} className="underline">
        {semHorario && temAnoLetivo ? "Horários" : "Calendário"}
      </Link>
      .
    </p>
  );
}
