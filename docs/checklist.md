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
- [x] **P1 · Perfis da equipe**: direção, coordenação e secretaria. Tela **Equipe e permissões** (só direção): cadastra pessoa com senha provisória (troca no 1º acesso em /senha), muda perfil, gera nova senha, remove (login bloqueado, não apagado; professor mantém o diário) e define por área (Comunicação, Secretaria, Estrutura, Avaliação, Acompanhamento) se cada perfil tem sem acesso / ver / editar. Menu mostra só o permitido; telas "ver" mostram faixa de somente consulta.
- [x] **P1 · Acompanhamento da coordenação**: Visão geral (aulas lançadas × previstas, sem chamada, notas do bimestre, planejamentos sem visto, alunos em risco, ocorrências), Professores em dia, Alunos em risco (presença < 75/80/85% e médias abaixo da média) e Ficha do aluno. Coordenação entra direto na Visão geral.
- [x] **P1 · Ocorrências**: coordenação registra (envia à família ou deixa interna, pode pedir ciência); professor registra pela área dele e fica aguardando revisão da coordenação; família vê no app (Família → Ocorrências), recebe aviso sem o conteúdo na notificação e confirma "Li e estou ciente" quando pedido. **Exige novo build do app** — cota gratuita do EAS (Android) esgotada em 14/10; volta em 01/11/2026.
- [ ] **P2 · Permissões no banco**: hoje a checagem é no painel; no banco toda a equipe segue `is_admin()`. Endurecer o RLS por perfil se a equipe crescer ou ganhar acesso direto ao Supabase.
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
- [x] Abas fixas (Mural · Hoje · Calendário · Família), com seletor de filho para quem tem mais de um
- [x] "Hoje na escola": conteúdo, tarefa e presença do filho em cada aula do dia; navegação entre dias; avisos do
      calendário; tarefas para entregar
- [x] Calendário escolar (eventos públicos da escola e da turma; próximos ou o ano todo)
- [x] Frequência do filho (total e por disciplina, % e alerta abaixo de 75%)
- [ ] Testar com dados reais (depende de aulas lançadas em 2027)
- [ ] **P1** Notas e boletim
- [ ] **P1** Horário semanal da turma do filho
- [x] Política de privacidade pública (`/privacidade` no painel; encarregado: secretaria@colegiozampieri.com.br),
      link na tela de entrada e na aba Família
- [x] Exclusão de conta pelo app (Família → Excluir minha conta): apaga login e notificações; registros escolares ficam
- [ ] Revisão da política por advogado (o texto descreve o que o app faz; as bases legais são uma leitura técnica)

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
- [x] Planejamento semanal e mensal (objetivos, conteúdos, metodologia, recursos, avaliação), cópia para outras turmas
      da mesma disciplina, visto e comentário da coordenação (o visto cai se o professor alterar depois)
- [x] Aula dupla: aulas seguidas da mesma disciplina viram um lançamento só (conteúdo e chamada para as duas)
- [ ] **P1** Lançamento de notas por avaliação

## 9. Coordenação e relatórios

- [x] Planejamentos da semana: quem planejou, quem não planejou, aguardando visto
- [x] Aulas não lançadas por professor/turma/dia (7 dias, 30 dias ou ano), com % lançado e aviso de professor sem acesso
- [x] Calendário de aulas da turma: mês a mês (previstas, lançadas, pendentes) e previstas por disciplina no ano e
      por bimestre
- [x] Sábado letivo "segue o horário de" um dia da semana (calendário, diário e cálculos)
- [ ] P1 Horário com vigência (mudança de horário no meio do ano sem alterar a conta dos meses anteriores)
- [ ] **P1** Frequência por aluno e por turma, alerta de alunos abaixo de 75%
- [ ] P1 Visão do diário de qualquer turma (leitura)
- [ ] P2 Ata de resultados, conselho de classe

## 10. Avaliação (notas)

- [x] Configuração por ano e segmento: avaliações e pesos, média (6), arredondamento da escola, recuperação
      bimestral, descritivo (Painel → Avaliação e boletim); regras de 2027 já carregadas
- [x] Professor lança notas por bimestre (média calculada na hora, recuperação aparece para quem ficou abaixo)
- [x] Infantil: parecer descritivo por disciplina e bimestre
- [x] Boletim no painel (por aluno ou turma inteira, imprimir/PDF, com faltas) e no app (só bimestres publicados)
- [x] Publicação do boletim por bimestre (família só vê depois de publicado)
- [ ] Confirmar com a escola: arredondamento aplicado à média do bimestre (antes da recuperação) e à média final
- [ ] P1 Fechamento do bimestre (travar a edição das notas depois de publicado)
- [ ] **P2** Recuperação final (substitui a média final, sem teto), resultado (aprovado, DP com < 3, reprovado,
      aprovado pelo conselho)
- [ ] P2 Frequência mínima de 75% no resultado (total e por disciplina)

## 11. Secretaria (para sair da Mhund — etapa 2)

Plano em 3 fases (decidido em 14/10/2026). **Decisão:** em 2027 a secretaria continua cadastrando aluno novo **na
Mhund**; na virada (Fase B) faz-se uma última importação e, dali em diante, aluno novo só pelo painel. Só um sistema
é "dono" do cadastro de cada vez — nunca os dois.

**Fase A — cadastro complementar (Mhund ainda é a dona de nome, turma e responsável financeiro)**

> **Situação em 16/10/2026: nenhum dado importado ainda.** No banco: 0 responsáveis vindos da Mhund, 1 aluno com
> dados pessoais (teste manual). A sincronização das 19h10 de 16/10 rodou **sem** a importação de cadastro — o painel
> no ar ainda não tinha essa versão (conferir o deploy no Easypanel / auto deploy).
>
> **Ordem para colocar o cadastro no ar:**
> 1. [ ] Deploy do painel com a versão atual (Easypanel) — conferir em Deployments que é o commit mais recente.
> 2. [ ] À noite (18h–8h), rodar `?ano=2027&simular=1` e conferir o bloco `"cadastro"` (quantos nascimentos,
>        responsáveis e vínculos seriam criados).
> 3. [ ] Deixar a sincronização das 19h10 rodar (importa nascimento + pai/mãe/responsáveis da API).
> 4. [ ] Montar na Mhund o CSV de **alunos** pelo modelo → Secretaria → Importar CSV → Conferir → Importar.
> 5. [ ] Montar o CSV de **responsáveis** pelo modelo → Conferir → Importar (só depois do passo 3).
> 6. [ ] Conferir alguns alunos no painel (Cadastro e matrícula) e liberar o acesso ao app de pai/mãe onde fizer sentido.
> 7. [ ] Rodar a limpeza das colunas antigas no SQL Editor (item abaixo).
- [x] Página **Cadastro e matrícula** do aluno (Secretaria → Alunos → aluno): dados pessoais — nome social, nascimento,
      naturalidade, nacionalidade (padrão Brasileira), CPF, RG, endereço com busca pelo CEP (ViaCEP). Telefone e
      e-mail do aluno = os do responsável financeiro.
- [x] Pais/responsáveis: CPF, RG, nome, nome social, nascimento, naturalidade, nacionalidade, estado civil, celular
      (55 + DDD + número, só dígitos), e-mail, pai/mãe/outro, responsável financeiro (um por aluno), acesso ao app.
      Pessoa cadastrada uma vez e ligada a cada filho (irmãos: o CPF reaproveita o cadastro).
- [x] Pai/mãe com celular ganham acesso ao app (LDB art. 12, VII: informar pai e mãe, convivendo ou não; tirar o
      acesso só com ordem judicial). A sincronização só remove acessos que ela criou (`origem = mhund`).
- [x] Matricular / trocar de turma pela página do aluno (inclusive turmas do ano seguinte).
- [x] Dados pessoais em tabela só da equipe (`aluno_dados`): professor não vê CPF, RG nem endereço.
- [x] **O que a API da Mhund devolve** (16/10/2026, `?campos=1`): aluno → sexo, nascimento, e-mail/celular, data de
      ingresso, ids de pai/mãe/financeiro; responsáveis → nome, CPF, e-mail, relação, nascimento, celular, financeiro.
      **Não existem lá:** CPF, RG, endereço e naturalidade do aluno; RG, estado civil e naturalidade dos pais.
- [x] Importação na sincronização noturna, **só preenchendo o que está vazio**: nascimento do aluno; pai, mãe e
      outros responsáveis (pessoa única por id da Mhund/CPF) e vínculos com parentesco. Vínculos importados entram com
      acesso ao app só para o financeiro (o de pai/mãe a secretaria libera no cadastro).
- [ ] Rodar uma vez `?ano=2027&simular=1` à noite e conferir o bloco `"cadastro"` antes da carga real.
- [x] Sexo do aluno (Censo Escolar): campo no cadastro e coluna no CSV de alunos.
- [ ] Digitação pela secretaria do que a Mhund não tem (CPF/RG/endereço/naturalidade). Ideia: a família preenche no
      app e a secretaria confere.
- [x] **Importar CSV** (Secretaria → Importar CSV): modelos de alunos (CPF, RG, sexo, nascimento, naturalidade,
      nacionalidade, endereço) e de responsáveis (RG, estado civil, naturalidade, nacionalidade, nome social); conferir
      antes de gravar; só preenche campos vazios. O arquivo vai direto ao banco (não passa pelo chat).
- [ ] Montar os CSVs na Mhund pelos modelos e importar (alunos primeiro; responsáveis depois da sincronização noturna).
- [ ] Rodar no SQL Editor (limpeza; colunas vazias de uma 1ª versão):
      `alter table public.alunos drop column if exists nome_social, drop column if exists nascimento, drop column if exists naturalidade, drop column if exists nacionalidade, drop column if exists cpf, drop column if exists rg, drop column if exists cep, drop column if exists logradouro, drop column if exists numero, drop column if exists complemento, drop column if exists bairro, drop column if exists cidade, drop column if exists uf, drop column if exists cadastro_atualizado_em;`
- [ ] Relatório de cadastros incompletos (sem CPF, sem endereço, sem responsável financeiro com celular).

**Fase B — virada (data a combinar; depois da rematrícula)**
- [ ] Última importação completa da Mhund (alunos, responsáveis, dados pessoais).
- [ ] Desligar a sincronização de alunos/responsáveis (`aluno_responsaveis` passa a ser mantido só pelo painel).
- [ ] **Novo aluno** pelo painel: código próprio do aluno, ficha completa, matrícula na turma.
- [ ] Nome e responsável financeiro editáveis no painel (hoje vêm da Mhund).
- [ ] Rematrícula feita no painel (hoje é só relatório).
- [ ] Treinar a secretaria antes da virada.

**Depois da virada (ainda etapa 2)**
- [ ] P2 Histórico escolar, declarações e documentos em PDF
- [ ] P2 Dados para o Censo Escolar (cor/raça, deficiência etc. — exigidos pelo INEP)

## 12. Financeiro (etapa 3)

**Fase C — só depois da virada do cadastro.** Decidir antes: quem emite boleto/Pix (Itaú por API ou Asaas), contrato,
planos e descontos/bolsas, multa e juros, nota fiscal de serviço (NFS-e), régua de cobrança, reajuste anual.
- [ ] P3 Mensalidades com baixa automática (Itaú por API ou Asaas)
- [ ] P3 Cobrança de inadimplência
- [ ] P3 Eventos e excursões pelo Asaas

## 13. Clube Zampieri (estacionado)

- [ ] P3 Assinatura pelo Asaas, conteúdos digitais, parceiros — ver `docs/plano-ecossistema.md`

## 14. Piloto

- [ ] **P0** Piloto do diário com 2–3 professores em novembro/2026 (chamada e conteúdo)
- [ ] **P0** Treinamento dos professores e da secretaria em janeiro/2027

---

Última atualização: 16/10/2026.
