# Sistema pedagógico próprio (para o ano letivo de 2027)

Objetivo: substituir o uso pedagógico da Mhund a partir de 2027, sem retrabalho. O financeiro (boletos Itaú)
continua na Mhund por enquanto; a migração dele vem depois, se o pedagógico der certo.

## Princípios

- **Lançamento único.** O professor lança só aqui (diário, frequência, tarefas, notas). Nada na Mhund.
- **Cadastro continua na Mhund** (aluno, família, matrícula), porque o financeiro está lá. O sistema **lê da Mhund**
  pela API (só leitura) e se mantém sincronizado: turmas, disciplinas, professores, vínculos e matrículas.
- **Nada travado.** Horários, intervalos, disciplinas, bimestres, calendário e regras de avaliação são editáveis no painel.
- **Professores usam pelo painel web** (responsivo: celular e computador), login por e-mail (o da Mhund).
- **Famílias veem no app:** "Hoje na escola" (conteúdo + tarefa), frequência, calendário, notas e boletim.
- **Registro escolar exportável em PDF a qualquer momento** (plano B se o sistema ficar fora do ar).

## Entregas pelo calendário escolar

| Quando a escola precisa | Módulo | Prazo |
| --- | --- | --- |
| 1º dia de aula de 2027 | Estrutura sincronizada, horários, calendário anual, diário (conteúdo, tarefa, frequência, planejamento), app das famílias | fim de janeiro/2027 |
| Fim do 1º bimestre | Notas, médias, recuperação bimestral, boletim | abril/2027 |
| Fim do ano | Recuperação final, conselho de classe, DP, ata de resultados, histórico, dados para o Censo | novembro/2027 |

## Dados da Mhund (API Integra, verificado em 09/10/2026)

- `Curso/{ano}`: 30 turmas em 2026 (descrição, série, turma, turno MA/TA, segmento).
- `Disciplina/{ano}`: 23 disciplinas. `Grade/{ano}`: 338 vínculos turma × disciplina × professor.
- `Professor/{ano}`: nome, e-mail, CPF. `Matricula/{ano}`: aluno, turma, nº de chamada, situação.
- `ConteudosLecionados` (máx. 7 dias por consulta em horário comercial), `NotaParcial`, `Boletos`,
  `OcorrenciasDisciplinares`: úteis para migrar histórico de 2026, se necessário.
- A API **não tem escrita**, nem frequência, horário de aula ou calendário.

## Estrutura escolar e horários

- Segmentos: Educação Infantil (1 turma, Pré 5 anos), Fundamental I, Fundamental II, Ensino Médio.
- Meio período. Aulas de 45 minutos.
  - Manhã: 07:15–12:50, 7 aulas, intervalo 09:30–09:50.
  - Tarde: 13:05–17:55, 6 aulas, intervalo 15:20–15:40.
- Algumas turmas têm horários diferentes: cada turma aponta para um modelo de horário (editável).
- Horário semanal por turma (dia × aula → disciplina) cadastrado no painel; alimenta o diário e o calendário.

## Avaliação (regras informadas pela escola; a confirmar os pontos marcados)

- **Infantil:** sem nota; relatório descritivo (por bimestre?).
- **Fundamental I:** 2 notas por bimestre (prova mensal + prova bimestral); média bimestral = média das duas.
- **Fundamental II e Médio:** 3 notas por bimestre (prova mensal, prova bimestral, avaliação bimestral); média azul 6.
- 4 bimestres; média final = média das 4 médias bimestrais.
- **Recuperação bimestral:** média do bimestre < 6 → avaliação única; se a nota for maior que a média, substitui.
- **Recuperação final:** média final < 6 → avaliação única (regra de substituição a confirmar).
- **Resultado:** mais de 3 recuperações finais → reprova ou aprovação pelo conselho; menos de 3 sem recuperar →
  aprova com DP, reprova ou aprova pelo conselho.
- **Frequência mínima:** 75%.

## Banco (migração 20261012000000_pedagogico_base.sql)

`anos_letivos`, `bimestres`, `modelos_horario` + `modelo_horario_aulas` (já com Manhã e Tarde), `turmas`,
`disciplinas`, `professores` (com `user_id` do login), `turma_disciplinas`, `matriculas`, `turma_horario`,
`calendario_eventos`, `aulas` (diário), `frequencias`, `planejamentos`.

Permissões (RLS): professor lança e edita só nas turmas/disciplinas que leciona; família vê aulas, tarefas e
calendário da turma do filho e a frequência só do próprio filho; planejamento não aparece para famílias;
equipe (admin) gerencia tudo.

## Próximos passos

1. Sincronização da estrutura a partir da Mhund (rota no painel, disparada pelo n8n).
2. Login de professores e telas do diário (lançamento rápido no celular).
3. Calendário anual e horários no painel.
4. "Hoje na escola" e frequência no app das famílias.
5. Notas e boletim (após confirmar as regras).
