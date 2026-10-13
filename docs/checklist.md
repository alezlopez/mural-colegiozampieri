# Checklist do sistema — Colégio Zampieri

Fonte única do que existe e do que falta. Atualizado a cada entrega (ver data e commit no fim).
Legenda: `[x]` feito · `[~]` parcial · `[ ]` a fazer · **P0** = precisa para o 1º dia de aula de 2027 ·
**P1** = até abril/2027 (1º bimestre) · **P2** = até o fim de 2027 · **P3** = depois.

Objetivo final: **sair da Mhund** (R$ 1.700/mês). O pedagógico roda no sistema próprio a partir de 2027;
cadastro de alunos/responsáveis continua vindo da Mhund (financeiro fica lá e no Itaú) até a etapa de secretaria.

---

## 0. Decisões tomadas (não rediscutir sem fato novo)

- [x] O sistema já trabalha com **2027** (o app não será usado em 2026). A base de 2026 (alunos, turmas,
      matrículas) fica como referência para a rematrícula.
- [x] **Nada mais de 2026 é sincronizado.** Da Mhund vêm só dados de **2027**: turmas, alunos, matrículas
      (ensalamento) e responsável financeiro. Professores e grade de 2027 são definidos **no painel**.
- [x] Ensalamento manual no painel vale mais que a Mhund (troca de turma não é desfeita).
- [x] O que é editado no painel vale mais que a Mhund (`editado_no_painel`).
- [x] Professores usam o painel web (celular e computador), login por e-mail.
- [x] Regras de avaliação definidas (ver `docs/pedagogico.md`); tudo configurável no painel.
- [x] App nas lojas (Play Store e App Store), não por APK.
- [x] Financeiro continua na Mhund/Itaú por enquanto; eventos pelo Asaas.
- [x] Clube Zampieri estacionado até o pedagógico estar no ar (plano em `docs/plano-ecossistema.md`).

## 1. Decisões em aberto (bloqueiam itens abaixo)

- [x] ~~Enturmação 2027~~: vem das matrículas 2027 da Mhund (decidido em 11/10/2026).
- [ ] **P0 · Desativar no app quem não rematriculou**: quando? (hoje eles continuam ativos; a lista está em
      Secretaria → Rematrícula.)
- [ ] **P1 · Perfis da equipe**: quem é secretaria, coordenação, direção (hoje todo admin vê e edita tudo).
- [ ] **P2 · Ocorrências disciplinares**: entram no sistema? (a Mhund tem.)

## 2. Infraestrutura e segurança

- [x] Supabase (projeto "app escola"), RLS em todas as tabelas, migrações versionadas em `supabase/migrations`
- [x] Painel Next.js no Easypanel (`appescola.colegiozampieri.com.br`)
- [x] Envio de código pelo WhatsApp (template de autenticação via n8n)
- [x] Push (Expo + Firebase), recibos de entrega (cron)
- [x] Builds do app no EAS a partir do GitHub (keystore e google-services no EAS)
- [x] Token do webhook do WhatsApp trocado
- [ ] Chave da API da Mhund: pedir nova ao suporte (a atual foi exposta)
- [ ] Supabase: ativar proteção contra senhas vazadas (Auth)
- [ ] Supabase: corrigir `search_path` da função `touch_updated_at` (aviso do advisor)
- [ ] **P0** Backup/exportação: registro escolar exportável em PDF (plano B)
- [ ] `instalacao_completa.sql` desatualizado (faltam as migrações do pedagógico)

## 3. Integração com a Mhund (temporária)

- [x] Cliente da API Integra (chave temporária, paginação, nova tentativa em falha)
- [x] Sincronização noturna (`POST /api/cron/sincronizar-mhund`): alunos novos, desativação de quem saiu, turma e
      nome do aluno, responsável financeiro (celular e CPF), relatório de celulares inválidos
- [x] Modos `?simular=1`, `?desde=AAAA-MM-DD`, `?ano=`, `?pedagogico=1`
- [x] Leitura do banco em páginas (o Supabase corta em 1.000 linhas)
- [x] Padrão: turmas + matrículas + alunos + responsáveis; `?grade=1` também disciplinas/professores/grade
- [x] Aluno trocado de turma na Mhund não fica em duas turmas; ensalados no painel são respeitados
- [x] Carga de 2027 feita (11/10/2026): 32 turmas, 513 alunos cursando (495 rematriculados, 18 novos)
- [ ] **P0** Agendamento das 2h no n8n passar a `?ano=2027` (ou variável `ANO_LETIVO_SINCRONIZACAO=2027`)
- [ ] Desligar o fluxo semanal antigo de alunos/responsáveis no n8n (depois da noite verde)
- [ ] Secretaria corrigir celular na Mhund: alunos 1155, 2293, 2448, 2654
- [ ] Desativar o aluno de teste "1" quando os testes acabarem

## 4. App das famílias

- [x] Mural com categorias, detalhe da publicação, publicações por turma
- [x] Login por código do aluno ou CPF do responsável + celular, código pelo WhatsApp
- [x] Biometria (Face ID / digital)
- [x] Push com abertura direta da publicação ou da carteirinha
- [x] Depois do login vai para o mural, com "Sua família" no topo
- [x] Carteirinha digital: QR que muda a cada 20 s, validação pública, foto do aluno
- [x] Envio da foto pelo app (câmera/galeria) com aprovação no painel e aviso por push
- [ ] **P0** Abas fixas (Mural · Hoje · Calendário · Família)
- [ ] **P0** "Hoje na escola": conteúdo e tarefa de cada aula do dia do filho
- [ ] **P0** Calendário escolar (eventos públicos da turma/escola)
- [ ] **P0** Frequência do filho (faltas por disciplina, % e alerta abaixo de 75%)
- [ ] **P1** Notas e boletim
- [ ] **P1** Horário semanal da turma do filho
- [ ] **P0** Política de privacidade (exigida pelas lojas) e exclusão de conta no app (exigência da Apple)

## 5. Lojas

- [ ] **P0** Conta Google Play **de organização** (CNPJ; evita a exigência de 20 testadores por 14 dias)
- [ ] **P0** Conta Apple Developer de organização (precisa do número D-U-N-S, que demora)
- [ ] **P0** Ficha da loja: ícone, capturas, descrição, classificação etária
- [ ] **P0** Build de produção (aab/ipa) e envio para revisão
- [ ] P1 Atualização pelo ar (expo-updates) para correções sem nova versão na loja

## 5b. Painel — Secretaria

- [x] Rematrícula 2026 → 2027: rematriculados, não rematriculados (evasão), concluintes, novos; por turma;
      contato do responsável (WhatsApp) e planilha para a secretaria
- [x] Turma de conclusão (3º ano do Médio) marcada: quem sai dela se formou, não evadiu

## 6. Painel — Comunicação

- [x] Publicações: criar, editar, excluir, imagens, categoria, público (todos ou turmas), push
- [x] Fotos dos alunos: aprovar/recusar com motivo
- [x] Página pública de validação da carteirinha
- [x] Menu agrupado (Comunicação, Pedagógico); no celular, botão Menu

## 7. Painel — Pedagógico (estrutura)

- [x] Turmas: criar, editar, inativar, excluir; grade da turma (professor por disciplina); renomear com segurança
- [x] Disciplinas: criar, editar, inativar, excluir
- [x] Professores: criar, editar (troca o login), inativar, excluir; atribuir disciplina a várias turmas
- [x] Acesso do professor: senha provisória, troca obrigatória no 1º login
- [x] Modelos de horário (início/fim das aulas) e horário semanal por turma, com aviso de choque de professor
- [x] Calendário: ano letivo, bimestres, eventos, contagem de dias letivos (200 da LDB), feriados nacionais
- [ ] P1 Copiar turmas de um ano para o outro (para quando a turma não vier da Mhund)
- [x] Ensalamento: colocar alunos (com sugestão dos que estão sem turma), trocar de turma em lote, retirar
- [x] Matriz curricular por série (disciplinas e aulas/semana), sugerida pela grade do ano anterior e aplicada às
      turmas da série; Horários mostra aulas colocadas/previstas
- [ ] **P0** Revisar e salvar a matriz de cada série de 2027 (13 séries) e preencher as aulas por semana
- [ ] **P0** Atribuir professores às disciplinas das turmas de 2027 (tela pronta; falta a escola definir)
- [ ] P1 Renumerar a chamada (ordem alfabética) depois do ensalamento
- [ ] **P0** Virada do ano: inativar as turmas de 2026 no painel e marcar 2027 como ano em uso
- [ ] P1 Cadastro de aluno pelo painel (aluno que ainda não está na Mhund)

## 8. Diário do professor

- [x] Tela "Hoje": aulas do dia pelo horário semanal, navegação entre dias, LANÇADA/LANÇAR
- [x] Lançar aula: conteúdo, tarefa com data de entrega, chamada (P / F / FJ)
- [x] Só as turmas do ano em uso (marcado no Calendário; sem marcação, o maior ano com turma ativa)
- [x] Respeita o calendário: feriado/recesso sem aula (escola toda ou por turma), avisos do dia, sábado letivo,
      fora do período letivo; "lançar mesmo assim" para exceções
- [x] Minhas turmas: alunos, aulas lançadas e última data por turma/disciplina
- [x] Histórico das aulas lançadas por turma/disciplina (ver e corrigir)
- [x] Frequência por aluno na disciplina (% e alerta abaixo de 75%; falta justificada conta como ausência)
- [ ] P1 Planejamento semanal/mensal (tabela já existe; falta a tela)
- [x] Aula dupla: aulas seguidas da mesma disciplina viram um lançamento só (conteúdo e chamada para as duas)
- [ ] **P1** Lançamento de notas por avaliação

## 9. Coordenação e relatórios

- [ ] **P0** Aulas não lançadas por professor/turma/dia (cobrança)
- [ ] **P1** Frequência por aluno e por turma, alerta de alunos abaixo de 75%
- [ ] P1 Visão do diário de qualquer turma (leitura)
- [ ] P2 Ata de resultados, conselho de classe

## 10. Avaliação (notas)

- [ ] **P1** Configuração por segmento: nº de notas, pesos, média azul (6), arredondamento da escola
- [ ] **P1** Notas por bimestre, média bimestral, recuperação bimestral (substitui se maior)
- [ ] **P1** Boletim (painel, PDF e app)
- [ ] P1 Infantil: relatório descritivo por bimestre
- [ ] **P2** Recuperação final (substitui a média final, sem teto), resultado (aprovado, DP com < 3, reprovado,
      aprovado pelo conselho)
- [ ] P2 Frequência mínima de 75% no resultado (total e por disciplina)

## 11. Secretaria (para sair da Mhund — etapa 2)

- [ ] P2 Cadastro completo de aluno e responsáveis no painel
- [ ] P2 Matrícula e rematrícula (a partir do sistema de rematrícula atual)
- [ ] P2 Histórico escolar, declarações e documentos em PDF
- [ ] P2 Dados para o Censo Escolar

## 12. Financeiro (etapa 3)

- [ ] P3 Mensalidades com baixa automática (Itaú por API ou Asaas)
- [ ] P3 Cobrança de inadimplência
- [ ] P3 Eventos e excursões pelo Asaas

## 13. Clube Zampieri (estacionado)

- [ ] P3 Assinatura pelo Asaas, conteúdos digitais, parceiros — ver `docs/plano-ecossistema.md`

## 14. Piloto

- [ ] **P0** Piloto do diário com 2–3 professores em novembro/2026 (chamada e conteúdo)
- [ ] **P0** Treinamento dos professores e da secretaria em janeiro/2027

---

Última atualização: 11/10/2026.
