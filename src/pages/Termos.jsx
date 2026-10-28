import React from "react";
import LegalLayout from "@/components/legal/LegalLayout";
import Secao from "@/components/legal/Secao";

// Termos de Uso: condições de utilização do app.
export default function Termos() {
  return (
    <LegalLayout titulo="Termos de Uso" atualizacao="27/10/2026">
      <Secao titulo="1. Aceitação">
        <p>
          Ao criar uma conta ou utilizar o BioAvalia App, você declara ter lido e concordado com estes Termos de Uso e
          com a Política de Privacidade. Caso não concorde, não utilize o app.
        </p>
      </Secao>

      <Secao titulo="2. O que o app faz">
        <p>
          O BioAvalia App organiza avaliações físicas e dados de bioimpedância, medidas de perímetro, anamneses e metas
          de proteína, gerando relatórios de acompanhamento. A conta é destinada a profissionais de saúde e fitness
          habilitados ao acompanhamento dos próprios clientes.
        </p>
      </Secao>

      <Secao titulo="3. Conta e acesso">
        <ul>
          <li>O cadastro exige o nome de Coach, que identifica os clientes, avaliações e a agenda do profissional.</li>
          <li>As credenciais são pessoais e intransferíveis; o profissional responde pela guarda da senha e pelas ações realizadas na conta.</li>
          <li>É necessário manter os dados de cadastro corretos e atualizados.</li>
        </ul>
      </Secao>

      <Secao titulo="4. Natureza das informações">
        <p>
          Os indicadores, classificações e metas exibidos são estimativas calculadas a partir dos dados informados e de
          protocolos de referência. Não substituem avaliação médica, nutricional ou diagnóstica, e a conduta clínica é
          de responsabilidade do profissional que acompanha o cliente.
        </p>
      </Secao>

      <Secao titulo="5. Responsabilidades do profissional">
        <ul>
          <li>Inserir dados apenas com autorização e ciência do cliente, mantendo o sigilo das informações de saúde.</li>
          <li>Utilizar os links de compartilhamento (relatório, anamnese e meta proteica) apenas com o próprio cliente.</li>
          <li>Conferir as informações lançadas antes de emitir relatórios ou orientações.</li>
        </ul>
      </Secao>

      <Secao titulo="6. Uso permitido">
        <p>É proibido:</p>
        <ul>
          <li>acessar dados de outros profissionais ou de clientes que não sejam seus;</li>
          <li>copiar, revender ou explorar comercialmente o app sem autorização;</li>
          <li>inserir conteúdo ilícito ou tentar comprometer a segurança e a disponibilidade do serviço.</li>
        </ul>
      </Secao>

      <Secao titulo="7. Integração com o Google Agenda">
        <p>
          A integração é opcional e feita com a conta Google do próprio profissional. Ao ativá-la, o profissional
          autoriza a criação e a leitura dos eventos de atendimento na agenda dele. O vínculo pode ser desfeito a
          qualquer momento; sem ele, a agenda do app continua funcionando normalmente.
        </p>
      </Secao>

      <Secao titulo="8. Propriedade intelectual">
        <p>
          O app, sua identidade visual e seu código pertencem aos seus titulares. Os dados e relatórios inseridos pelo
          profissional permanecem de responsabilidade dele e dos seus clientes.
        </p>
      </Secao>

      <Secao titulo="9. Disponibilidade e limitação de responsabilidade">
        <p>
          O app é fornecido no estado em que se encontra. Podem ocorrer indisponibilidades por manutenção, falhas de
          terceiros ou motivos alheios ao nosso controle. Na máxima extensão permitida em lei, não respondemos por
          decisões clínicas, perdas decorrentes de dados inseridos incorretamente ou por danos indiretos.
        </p>
      </Secao>

      <Secao titulo="10. Encerramento">
        <p>
          O uso pode ser encerrado a qualquer momento pelo profissional, mediante exclusão da conta. O uso indevido,
          que viole estes termos ou a legislação, pode levar à suspensão do acesso.
        </p>
      </Secao>

      <Secao titulo="11. Alterações">
        <p>
          Estes termos podem ser atualizados. A versão vigente é a publicada nesta página, com a data de atualização
          indicada no topo.
        </p>
      </Secao>

      <Secao titulo="12. Legislação e foro">
        <p>
          Aplica-se a legislação brasileira, incluindo a LGPD e o Código de Defesa do Consumidor quando cabível.
          Eventuais controvérsias serão resolvidas no foro do domicílio do profissional usuário.
        </p>
      </Secao>
    </LegalLayout>
  );
}