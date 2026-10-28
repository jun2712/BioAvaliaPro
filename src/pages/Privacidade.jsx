import React from "react";
import LegalLayout from "@/components/legal/LegalLayout";
import Secao from "@/components/legal/Secao";

// Política de Privacidade: descreve o tratamento de dados realizado pelo app.
export default function Privacidade() {
  return (
    <LegalLayout titulo="Política de Privacidade" atualizacao="27/10/2026">
      <Secao titulo="1. Quem trata os seus dados">
        <p>
          O BioAvalia App é uma ferramenta de gestão de avaliação física usada por profissionais de saúde e fitness
          (Coach). O profissional responsável pela conta é o controlador dos dados dos seus clientes e é quem define
          quais dados são coletados e com quem são compartilhados. O app atua como ferramenta de tratamento, conforme
          as instruções desse profissional.
        </p>
      </Secao>

      <Secao titulo="2. Dados tratados">
        <ul>
          <li>Cadastro do profissional: nome de Coach, e-mail, senha (armazenada de forma criptografada) e preferências de exibição do relatório.</li>
          <li>Cadastro de clientes e prospectos: nome, WhatsApp, e-mail, data de nascimento, sexo, altura, objetivo, status do acompanhamento e notas.</li>
          <li>Dados de saúde e composição corporal: peso, bioimpedância, medidas de perímetro, respostas de anamnese e meta proteica calculada.</li>
          <li>Agenda: data, horário e tipo de atendimento, além do vínculo com eventos do Google Agenda quando essa integração é ativada.</li>
          <li>Registros técnicos de acesso e de uso, necessários para segurança e funcionamento do serviço.</li>
        </ul>
      </Secao>

      <Secao titulo="3. Para que os dados são usados">
        <ul>
          <li>Registrar avaliações, gerar relatórios de evolução e acompanhar o plano dos clientes.</li>
          <li>Calcular indicadores e metas, como a meta diária de proteína, a partir das respostas informadas.</li>
          <li>Organizar a agenda de atendimentos e enviar lembretes pelo WhatsApp quando o profissional aciona esse envio.</li>
          <li>Manter a segurança da conta, prevenir acessos indevidos e dar suporte ao profissional.</li>
        </ul>
      </Secao>

      <Secao titulo="4. Bases legais">
        <p>
          O tratamento ocorre para execução do contrato de uso do app, para cumprimento de obrigações legais e, no caso
          de dados de saúde, com o consentimento do titular e para a tutela da saúde por profissional habilitado, nos
          termos da Lei nº 13.709/2018 (LGPD).
        </p>
      </Secao>

      <Secao titulo="5. Compartilhamento">
        <ul>
          <li>Google Agenda: somente se o profissional vincular a própria conta. Os eventos de atendimento são criados na agenda dele e o app lê alterações feitas lá.</li>
          <li>Provedores de infraestrutura e de inteligência artificial que apoiam o armazenamento, o envio de e-mails e a análise de anamnese, sempre limitados à finalidade do serviço.</li>
          <li>Links de compartilhamento gerados pelo profissional (relatório, anamnese e meta proteica), acessíveis a quem receber o link.</li>
          <li>Autoridades públicas, quando houver determinação legal.</li>
        </ul>
        <p>Os dados não são vendidos nem usados para publicidade.</p>
      </Secao>

      <Secao titulo="6. Segurança e retenção">
        <p>
          O acesso ao app exige autenticação, e cada profissional acessa os registros da própria conta. Os dados são
          mantidos enquanto a conta existir ou enquanto forem necessários ao acompanhamento; depois disso podem ser
          excluídos a pedido do profissional ou do titular.
        </p>
      </Secao>

      <Secao titulo="7. Direitos do titular">
        <p>O titular pode solicitar, a qualquer momento:</p>
        <ul>
          <li>confirmação de que os dados são tratados e acesso a eles;</li>
          <li>correção de dados incompletos ou desatualizados;</li>
          <li>portabilidade e eliminação dos dados tratados com consentimento;</li>
          <li>informação sobre compartilhamentos e revogação do consentimento.</li>
        </ul>
        <p>
          Os pedidos devem ser dirigidos ao profissional responsável pelo atendimento, que administra a conta e os
          registros dos clientes no app.
        </p>
      </Secao>

      <Secao titulo="8. Crianças e adolescentes">
        <p>
          Dados de menores de 18 anos devem ser inseridos apenas com o consentimento e o acompanhamento do responsável
          legal, sob responsabilidade do profissional que utiliza o app.
        </p>
      </Secao>

      <Secao titulo="9. Armazenamento local">
        <p>
          O app usa o armazenamento do navegador apenas para manter a sessão autenticada e as preferências de exibição.
          Não são utilizados cookies de publicidade.
        </p>
      </Secao>

      <Secao titulo="10. Alterações desta política">
        <p>
          Esta política pode ser atualizada para refletir mudanças no app ou na legislação. A data de atualização no
          topo indica a última versão, e o uso contínuo do app após a publicação implica ciência das mudanças.
        </p>
      </Secao>
    </LegalLayout>
  );
}