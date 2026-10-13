import type { Metadata } from "next";
import Image from "next/image";

// Política de privacidade do app (página pública: as lojas exigem um endereço aberto).
// Ao mudar o que o app coleta, atualize esta página e a data de vigência.

export const metadata: Metadata = {
  title: "Política de privacidade · Colégio Zampieri",
  description: "Como o app do Colégio Zampieri trata os dados de responsáveis e alunos.",
};

const ENCARREGADO = "secretaria@colegiozampieri.com.br";
const VIGENCIA = "13 de outubro de 2026";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-branco-quente">
      <header className="bg-verde-escuro text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
            <Image src="/brasao.png" alt="" width={29} height={36} />
          </span>
          <span>
            <span className="block font-titulo text-xl leading-tight">Colégio Zampieri</span>
            <span className="block text-[10px] font-bold tracking-[0.2em] text-dourado-claro">POLÍTICA DE PRIVACIDADE</span>
          </span>
        </div>
        <div className="tricolor h-1" />
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-[15px] leading-relaxed text-texto [&_h2]:mt-8 [&_h2]:font-titulo [&_h2]:text-xl [&_h2]:text-verde-escuro [&_li]:ml-5 [&_li]:list-disc">
        <div>
          <h1 className="font-titulo text-3xl text-verde-escuro">Política de privacidade do app</h1>
          <p className="mt-1 text-sm text-texto-suave">Vigente desde {VIGENCIA}.</p>
        </div>

        <p>
          Esta política explica como o <strong>Colégio Zampieri</strong> trata os dados pessoais no aplicativo da escola e no
          painel usado pela equipe, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). O Colégio é o controlador dos
          dados.
        </p>

        <h2>Encarregado pelos dados</h2>
        <p>
          Dúvidas, pedidos e reclamações sobre dados pessoais:{" "}
          <a href={`mailto:${ENCARREGADO}`} className="font-bold text-verde-claro underline">
            {ENCARREGADO}
          </a>
          .
        </p>

        <h2>Quais dados o app usa</h2>
        <p>
          <strong>Do responsável:</strong> nome, celular e CPF que constam no cadastro da escola. Eles servem para confirmar que
          quem entra no app é o responsável pelo aluno. Para entrar, enviamos um código de confirmação por WhatsApp ao celular
          cadastrado.
        </p>
        <p>
          <strong>Do aluno:</strong> nome, código, turma, frequência, conteúdo das aulas e tarefas da turma, calendário escolar
          e, quando disponíveis, notas e boletim. A foto do aluno para a carteirinha só existe se o responsável a enviar pelo
          app, e passa por aprovação da escola antes de aparecer.
        </p>
        <p>
          <strong>Do aparelho:</strong> um identificador para enviar notificações e o tipo de sistema (Android ou iOS). A
          biometria (digital ou reconhecimento facial), quando ativada, é verificada pelo próprio celular: a escola não recebe
          nem guarda a sua digital ou o seu rosto.
        </p>
        <p>
          <strong>Carteirinha digital:</strong> quando alguém lê o código QR da carteirinha, registramos a data, a hora e se a
          carteirinha era válida. Não identificamos quem fez a leitura.
        </p>
        <p>O app não tem publicidade, não vende dados e não usa dados para criar perfis de comportamento.</p>

        <h2>Para que usamos</h2>
        <ul>
          <li>Comunicação entre a escola e as famílias (mural, avisos e notificações).</li>
          <li>Acompanhamento da vida escolar: aulas, tarefas, frequência, calendário, notas e boletim.</li>
          <li>Identificação do aluno pela carteirinha digital.</li>
          <li>Segurança do acesso, para que cada família veja apenas os dados dos próprios filhos.</li>
        </ul>

        <h2>Por que podemos tratar esses dados</h2>
        <p>
          O tratamento se apoia na execução do contrato de prestação de serviços educacionais, no cumprimento das obrigações
          legais da escola (como o registro da vida escolar) e no legítimo interesse de manter a comunicação com as famílias.
          Os dados de crianças e adolescentes são tratados no seu melhor interesse, e a foto do aluno é enviada por iniciativa
          do responsável.
        </p>

        <h2>Com quem compartilhamos</h2>
        <p>Apenas com fornecedores que operam o serviço em nome da escola, para estas finalidades:</p>
        <ul>
          <li>Supabase: banco de dados, login e armazenamento das fotos.</li>
          <li>Expo e Google Firebase: entrega das notificações no celular.</li>
          <li>Meta (WhatsApp): envio do código de confirmação para entrar no app.</li>
          <li>Provedor de hospedagem do painel da escola.</li>
        </ul>
        <p>Esses fornecedores podem armazenar dados em servidores fora do Brasil.</p>

        <h2>Por quanto tempo guardamos</h2>
        <ul>
          <li>O acesso ao app existe enquanto houver vínculo do aluno com a escola, ou até o responsável excluir a conta.</li>
          <li>A foto do aluno fica guardada até ser substituída ou até um pedido de exclusão.</li>
          <li>Os registros escolares (frequência, notas, conteúdo das aulas) são mantidos pelos prazos exigidos pela legislação educacional.</li>
        </ul>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir a confirmação e o acesso aos dados, a correção de dados incompletos ou errados, a exclusão de dados
          desnecessários, informações sobre o compartilhamento e a revisão desta autorização, entre os demais direitos do
          artigo 18 da LGPD. Faça o pedido pelo e-mail do encarregado. Correções de cadastro (nome, celular, CPF) são feitas
          pela secretaria da escola.
        </p>

        <h2>Como excluir sua conta</h2>
        <p>
          No app, abra a aba <strong>Família</strong> e toque em <strong>Excluir minha conta</strong>. Isso apaga o seu acesso
          ao app e desliga as notificações neste celular. Os registros escolares do aluno não são apagados, porque a escola é
          obrigada a mantê-los. Se você voltar a entrar com o código enviado por WhatsApp, um novo acesso é criado.
        </p>

        <h2>Segurança</h2>
        <p>
          O acesso exige o código enviado ao celular cadastrado e pode ser protegido por biometria. Regras no banco de dados
          garantem que cada responsável veja apenas os dados dos próprios filhos, e as fotos são exibidas por endereços
          temporários.
        </p>

        <h2>Alterações</h2>
        <p>Esta política pode ser atualizada. A data de vigência no topo indica a versão atual.</p>
      </main>

      <footer className="border-t border-borda py-6 text-center text-xs tracking-[0.15em] text-texto-suave">
        COLÉGIO ZAMPIERI · TRADIÇÃO EM EDUCAÇÃO
      </footer>
    </div>
  );
}
