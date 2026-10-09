# Sistema pedagógico próprio (para o ano letivo de 2027)

Objetivo final: **sair da Mhund** (R$ 1.700/mês). Começa pelo pedagógico, em uso a partir de 2027.

**Plano de saída da Mhund:**
1. 2027: pedagógico próprio (diário, frequência, notas, boletim). A Mhund fica só com cadastro/matrícula e financeiro,
   e o sistema lê dela automaticamente (sem retrabalho).
2. Cadastro, matrícula e rematrícula próprios (a partir do sistema de rematrícula que a escola já tem): o painel
   vira a fonte; a sincronização com a Mhund é desligada.
3. Financeiro próprio (mensalidades com baixa automática; Itaú por API ou Asaas) e cobrança de inadimplência.
4. Documentos e Censo Escolar → cancelar a Mhund.

O banco já nasce independente: ids próprios, e a Mhund aparece só como referência (`mhund_id`).

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

Regras de uso da API (observadas):
- Listagens **sem data** devolvem só o que mudou desde a última consulta (não servem para carga completa).
- Com `/{ano}/{desde}` devolvem tudo que mudou desde a data; `Disciplina/{ano}` sempre devolve a lista toda.
- Carga completa de matrículas só **entre 18h e 8h**; de dia, no máximo 30 dias para trás.
- Consultas simultâneas falham (HTTP 500): a sincronização consulta em sequência.
- Situação da matrícula: `L` = cursando (também T, D, C, Z em 2026).


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

## Avaliação (regras informadas pela escola em 09/10/2026)

- **Infantil:** sem nota; relatório descritivo **por bimestre**.
- **Fundamental I:** 2 notas por bimestre (prova mensal + prova bimestral), mesmo peso; média azul **6**.
- **Fundamental II e Médio:** 3 notas por bimestre (prova mensal, prova bimestral, avaliação bimestral), **mesmo peso**;
  média azul **6**.
- 4 bimestres; média final = média das 4 médias bimestrais.
- **Recuperação bimestral:** média do bimestre < 6 → avaliação única; se a nota for maior que a média, substitui.
- **Recuperação final** (por disciplina): média final < 6 → avaliação única; se a nota for maior, **substitui a média
  final pelo valor obtido** (ex.: tirou 8, fica 8; sem teto em 6).
- **Resultado:** mais de 3 recuperações finais → reprova, ou aprova pelo conselho de classe; menos de 3 e não
  recuperou → aprova com DP, reprova ou aprova pelo conselho. **Exatamente 3: a confirmar.**
- **Frequência mínima:** 75%, controlada no total **e por disciplina**.
- **Arredondamento** (regra da escola, sobre a parte decimal):

  | Parte decimal | Vira |
  | --- | --- |
  | de 0,00 até 0,25 | 0,00 (arredonda para baixo) |
  | acima de 0,25 até 0,59 | 0,50 |
  | de 0,60 até 1,00 | 1,00 (arredonda para cima) |

  Ex.: 6,25 → 6,0; 6,3 → 6,5; 6,6 → 7,0. Tudo isso fica configurável no painel (faixas, média azul, pesos).

## Banco (migração 20261012000000_pedagogico_base.sql)

`anos_letivos`, `bimestres`, `modelos_horario` + `modelo_horario_aulas` (já com Manhã e Tarde), `turmas`,
`disciplinas`, `professores` (com `user_id` do login), `turma_disciplinas`, `matriculas`, `turma_horario`,
`calendario_eventos`, `aulas` (diário), `frequencias`, `planejamentos`.

Permissões (RLS): professor lança e edita só nas turmas/disciplinas que leciona; família vê aulas, tarefas e
calendário da turma do filho e a frequência só do próprio filho; planejamento não aparece para famílias;
equipe (admin) gerencia tudo.

## Próximos passos

1. Sincronização da estrutura a partir da Mhund: **feita** (`POST /api/cron/sincronizar-mhund`, com
   `Authorization: Bearer <CRON_SECRET>`; `?simular=1` só mostra o que mudaria; `?desde=AAAA-MM-DD` para coleta
   parcial de dia). Agendar no n8n **de madrugada** (coleta completa). Também desativa no app o aluno que deixou de
   cursar (situação ≠ L) e atualiza a turma dele; alunos cadastrados à mão (fora da Mhund) não são tocados.
2. Login de professores e telas do diário (lançamento rápido no celular).
3. Calendário anual e horários no painel.
4. "Hoje na escola" e frequência no app das famílias.
5. Notas e boletim (após confirmar as regras).
