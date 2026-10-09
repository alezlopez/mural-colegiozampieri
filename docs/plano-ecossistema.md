# Plano do ecossistema Colégio Zampieri (app, Clube e integrações)

Registro das decisões tomadas até aqui. Atualize conforme o projeto avança.

## Princípios

- **App gratuito para todas as famílias:** mural, avisos da turma, push, área da família e **carteirinha do aluno**.
- **Clube Zampieri (assinatura) é extra**, nunca algo que a escola já deve às famílias (avisos, informação sobre o filho).
- **Hub único:** Supabase + painel são a fonte da verdade de identidade e assinatura. Os outros sistemas consultam o hub.
- **Chave comum entre sistemas: CPF do responsável financeiro** (já sincronizado e usado no login).
- **Distribuição:** Play Store e App Store com contas de organização (CNPJ/D-U-N-S). APK só para testes internos.

## Carteirinha do aluno (gratuita, implementada)

- Na área da família, cada filho abre a carteirinha: nome, turma, código, ano letivo e um **QR que muda a cada 30 s**
  (assinado no banco; vale ~60 s; print ou foto não servem).
- Quem escaneia abre `https://<painel>/v/<código>`: mostra "Aluno matriculado" ou o motivo da recusa, e cada leitura
  fica registrada em `carteirinha_validacoes`.
- **Não garante meia-entrada:** a Lei 12.933/2013 e o Decreto 8.537/2015 exigem a CIE no modelo nacional, emitida por
  entidades estudantis (UBES/UNE/ANPG). Divulgar como identificação do aluno (portaria, excursões, eventos, parceiros).
- O formato do código já prevê outros tipos (`c` = assinante do Clube), reaproveitando a mesma página de validação.

## Clube Zampieri (assinatura), ainda não implementado

**Venda fora do app.** A assinatura inclui conteúdo digital; vendida dentro do app, Google e Apple exigiriam o
pagamento deles (15–30%). Ela é vendida no site (`/assinar`) e o app só reconhece quem é assinante, **sem botão,
link ou chamada de compra dentro do app**. Divulgação por WhatsApp, e-mail, reuniões e eventos. Confirmar a política
vigente das lojas antes do lançamento.

**Benefícios no lançamento:** desconto nos eventos (sistema de eventos próprio, Asaas) e conteúdos digitais exclusivos.
Depois: parceiros (clube de descontos), tutor de IA, destaque pago para parceiros.

**Arquitetura:**

```
Família ──(site /assinar, login CPF + celular + WhatsApp)──► Hub ──cria cliente/assinatura──► Asaas
                                                              ▲ └── webhook: pago / atrasado / cancelado
App: carteirinha do Clube (QR tipo "c") ──────────────────────┤
Parceiro/portaria escaneia ──► /v/<código> (registra leitura)  │
Sistema de eventos ──(GET /api/clube/status?cpf=..., token)───┘──► aplica desconto
```

- Uma assinatura por família (CPF do responsável financeiro), valendo para todos os filhos.
- Só famílias com aluno ativo podem assinar (depois: ex-alunos).
- Status calculado pelo pagamento ("pago até" + tolerância). Sem cadastro manual.

**Fases:**

0. Decisões e burocracia: contador (CNPJ, CNAE, nota fiscal), preço e preço de fundador, desconto nos eventos,
   termos de uso e privacidade (LGPD; arrependimento de 7 dias, CDC art. 49), Asaas (recorrência e taxas),
   contas de desenvolvedor, 10–20 conteúdos prontos para o dia 1.
1. MVP técnico: tabelas de assinatura, webhook Asaas (idempotente), `/assinar` e "minha assinatura",
   carteirinha do Clube, "só assinantes" nos posts, painel de assinantes, API de status para o sistema de eventos,
   testes no sandbox do Asaas.
2. Piloto com 20–40 famílias fundadoras (preço travado), 4 semanas, medindo conversão, uso e cancelamento.
3. Lançamento geral (divulgação fora do app).
4. Escala: parceiros (portal + relatórios), eventos dentro do app (serviço físico: sem comissão de loja),
   tutor de IA em piloto, destaque pago, gestão escolar própria substituindo a sincronização com a Mhund.

**Métricas desde o dia 1:** assinantes ativos, receita, cancelamentos/mês, custo dos descontos em eventos,
leituras de carteirinha, conteúdos abertos por assinante.

**Decisões pendentes para a Fase 1:** preço e preço de fundador; desconto nos eventos (fixo ou por evento);
tolerância de atraso (sugestão: 5 dias); mesma conta Asaas do sistema de eventos?
