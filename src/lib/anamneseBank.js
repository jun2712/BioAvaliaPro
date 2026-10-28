// Banco de perguntas da anamnese — modelo FineShape (125 perguntas).
// tipo: "select" = resposta com opções pré-definidas | "text" = resposta aberta.
// As opções dos dropdowns não constavam no modelo original e foram definidas
// com base no conteúdo de cada pergunta.

const SIM_NAO = ["Sim", "Não"];
const DIFICULDADE = ["Nenhuma", "Um pouco", "Moderada", "Muita", "Extrema"];

const s = (codigo, categoria, pergunta, opcoes) => ({ codigo, categoria, pergunta, tipo: "select", opcoes });
const t = (codigo, categoria, pergunta) => ({ codigo, categoria, pergunta, tipo: "text", opcoes: [] });
const n = (codigo, categoria, pergunta) => ({ codigo, categoria, pergunta, tipo: "number", opcoes: [] });

export const CATEGORIAS_ANAMNESE = ["Meta Proteica", "Hábitos", "Física", "Clínica", "Bem-estar", "Estética", "Par-Q", "Aha", "Geral"];

export const PERGUNTAS_ANAMNESE = [
  // --- Meta Proteica (701-707) ---
  // Grupo padrão usado pela calculadora de meta proteica. As respostas de 702 a 704
  // são numéricas e podem vir pré-preenchidas da ficha do cliente.
  s("701", "Meta Proteica", "Sexo", ["Feminino", "Masculino"]),
  n("702", "Meta Proteica", "Qual é a sua idade? (anos)"),
  n("703", "Meta Proteica", "Qual é o seu peso atual? (kg)"),
  n("704", "Meta Proteica", "Qual é a sua altura? (cm)"),
  s("705", "Meta Proteica", "Nível de atividade física", ["Sedentário", "Leve", "Moderado", "Intenso"]),
  s("706", "Meta Proteica", "Objetivo principal", ["Manutenção / bem-estar", "Ganho de massa muscular", "Emagrecimento"]),
  s("707", "Meta Proteica", "Você usa análogos de GLP-1 (Ozempic, Mounjaro e similares)?", ["Sim", "Não"]),

  // --- Hábitos (101-114) ---
  s("101", "Hábitos", "Em média, quantas horas de sono por dia?", ["Menos de 5 horas", "5 a 6 horas", "7 a 8 horas", "Mais de 8 horas"]),
  s("102", "Hábitos", "Em média, quantas horas você trabalha por dia?", ["Menos de 6 horas", "6 a 8 horas", "9 a 10 horas", "Mais de 10 horas"]),
  s("103", "Hábitos", "Na maior parte do tempo no seu trabalho você fica?", ["Sentado", "Em pé", "Andando", "Alternando posturas"]),
  s("104", "Hábitos", "Qual é sua frequência semanal no uso de bebida alcoólica?", ["Não consumo", "1 a 2 vezes por semana", "3 a 4 vezes por semana", "Quase todos os dias"]),
  s("105", "Hábitos", "Você Fuma?", ["Não fumo", "Fumo ocasionalmente", "Fumo todos os dias", "Parei recentemente"]),
  s("106", "Hábitos", "Alimentação balanceada?", ["Sempre", "Na maioria das vezes", "Raramente", "Nunca"]),
  s("107", "Hábitos", "Alterações do apetite?", ["Normal", "Aumentado", "Reduzido", "Variável"]),
  t("108", "Hábitos", "Quantas refeições faz por dia?"),
  t("109", "Hábitos", "Qual é seu consumo diário de água?"),
  t("110", "Hábitos", "Segue alguma dieta especial? Qual?"),
  t("111", "Hábitos", "Você usa suplementos? Quais?"),
  t("112", "Hábitos", "Você usa anabolizantes? Quais?"),
  t("113", "Hábitos", "Possui intolerância alimentar? Qual?"),
  s("114", "Hábitos", "Qual é o seu hábito intestinal?", ["Diário", "Dia sim, dia não", "2 a 3 vezes por semana", "Irregular"]),

  // --- Física (201-213) ---
  s("201", "Física", "Quais são seus objetivos?", ["Emagrecer", "Ganhar massa muscular", "Condicionamento físico", "Saúde e qualidade de vida", "Estética"]),
  s("202", "Física", "Qual é o seu nível de condicionamento?", ["Sedentário", "Iniciante", "Intermediário", "Avançado"]),
  s("203", "Física", "Qual seu nível de atividade física?", ["Não pratico", "1 a 2 vezes por semana", "3 a 4 vezes por semana", "5 ou mais vezes por semana"]),
  s("204", "Física", "Etnia Predominante?", ["Branco", "Negro", "Pardo", "Asiático", "Indígena"]),
  t("205", "Física", "Já praticou alguma atividade física no passado? Quais e por quanto tempo?"),
  t("206", "Física", "Pratica alguma atividade física atualmente? Quais e por quanto tempo?"),
  s("207", "Física", "Normalmente qual é a sua dificuldade pra correr, levantar objetos pesados, praticar esportes ou realizar trabalhos pesados?", DIFICULDADE),
  s("208", "Física", "Normalmente qual é a sua dificuldade para abaixar-se, ajoelhar-se ou curvar-se?", DIFICULDADE),
  s("209", "Física", "Normalmente qual é a sua dificuldade para andar cerca de 100 metros ou pés?", DIFICULDADE),
  s("210", "Física", "Normalmente qual é a sua dificuldade para andar mais do que 1 quilômetro ou milha?", DIFICULDADE),
  s("211", "Física", "Normalmente qual é a sua dificuldade para empurrar mesa ou realizar consertos domésticos?", DIFICULDADE),
  s("212", "Física", "Normalmente qual é a sua dificuldade para subir ladeira ou escada?", DIFICULDADE),
  s("213", "Física", "Normalmente qual é a sua dificuldade pra sentar, tomar banho ou ir ao banheiro?", DIFICULDADE),

  // --- Clínica (301-324) ---
  s("301", "Clínica", "Qual é o seu tipo sanguíneo?", ["A", "B", "AB", "O"]),
  s("302", "Clínica", "Fator RH?", ["Positivo", "Negativo"]),
  s("303", "Clínica", "Qual seu nível de estresse?", ["Baixo", "Moderado", "Alto", "Muito alto"]),
  s("304", "Clínica", "Possui diabetes? Que tipo?", ["Não", "Tipo 1", "Tipo 2", "Pré-diabetes"]),
  t("305", "Clínica", "Possui alergia? Qual?"),
  t("306", "Clínica", "Faz uso contínuo de medicamentos? Quais são?"),
  s("307", "Clínica", "Seu ciclo menstrual é regular?", ["Regular", "Irregular", "Não se aplica"]),
  t("308", "Clínica", "Faz uso de anticoncepcional? Qual?"),
  s("309", "Clínica", "Portador de Marcapasso?", SIM_NAO),
  s("310", "Clínica", "Funcionamento intestinal é regular?", ["Regular", "Irregular"]),
  t("311", "Clínica", "Existe doenças familiares? Quais são?"),
  t("312", "Clínica", "Possui antecedentes oncológicos? Quais são?"),
  t("313", "Clínica", "Possui distúrbio circulatório? Qual?"),
  t("314", "Clínica", "Possui distúrbio gastrointestinal? Qual?"),
  t("315", "Clínica", "Possui distúrbio hormonal? Qual?"),
  t("316", "Clínica", "Possui distúrbio renal? Qual?"),
  t("317", "Clínica", "Possui epilepsia ou convulsões? Qual é a frequência?"),
  t("318", "Clínica", "Possui alguma dor? Quais são?"),
  t("319", "Clínica", "Possui cirurgias ou internações? Quais foram?"),
  t("320", "Clínica", "Possui doenças anteriores? Quais são?"),
  s("321", "Clínica", "Possui hipo/hipertensão arterial?", ["Não", "Hipotensão", "Hipertensão", "Ambas"]),
  t("322", "Clínica", "Possui lesões anteriores? Quais são?"),
  s("323", "Clínica", "Sente alguma ardência ao urinar?", SIM_NAO),
  t("324", "Clínica", "Qual é a coloração e consistência das suas fezes?"),

  // --- Bem-estar (401-419) ---
  s("401", "Bem-estar", "Você tem o hábito de fazer lanches saudáveis entre as refeições?", SIM_NAO),
  s("402", "Bem-estar", "Faz parte da sua rotina tomar café da manhã todos os dias?", SIM_NAO),
  s("403", "Bem-estar", "Você dá preferência a cortes magros de carne, aves sem pele e peixes ao invés de carnes fritas ou com gordura aparente?", SIM_NAO),
  s("404", "Bem-estar", "Em geral, você consome mais arroz, massas, cereais e pães integrais do que as versões tradicionais?", SIM_NAO),
  s("405", "Bem-estar", "Você consome peixes de água salgada como salmão, cavala, sardinha e truta, pelo menos 3 vezes por semana?", SIM_NAO),
  s("406", "Bem-estar", "Você consome ao menos 8 copos de água por dia?", SIM_NAO),
  s("407", "Bem-estar", "Você toma mais água e bebidas com baixo valor calórico do que outras bebidas açucaradas?", SIM_NAO),
  s("408", "Bem-estar", "Ao longo do dia, você tem energia e se sente disposto para realizar suas atividades?", SIM_NAO),
  s("409", "Bem-estar", "No seu dia a dia, você se sente mais calmo do que estressado?", SIM_NAO),
  s("410", "Bem-estar", "Você come 6 ou mais porções de frutas, legumes ou verduras por dia?", SIM_NAO),
  s("411", "Bem-estar", "Você conhece suplementos vitamínicos e minerais e sabe para que servem?", SIM_NAO),
  s("412", "Bem-estar", "Você procura variar os alimentos que come, montando pratos coloridos e evitando cair na monotonia?", SIM_NAO),
  s("413", "Bem-estar", "Você sabe da importância do cálcio para a saúde e procura consumir a quantidade adequada diariamente?", SIM_NAO),
  s("414", "Bem-estar", "Você pratica atividade física ao menos 30 minutos por dia?", SIM_NAO),
  s("415", "Bem-estar", "Você costuma ter tempo para fazer suas refeições?", SIM_NAO),
  s("416", "Bem-estar", "Você reserva parte do tempo da sua semana para passear, encontrar seus amigos ou fazer atividades que você goste?", SIM_NAO),
  s("417", "Bem-estar", "Você acha fácil manter o seu peso adequado?", SIM_NAO),
  s("418", "Bem-estar", "Você está feliz com seu corpo e seu peso?", SIM_NAO),
  t("419", "Bem-estar", "Quais são seus objetivos pessoais?"),

  // --- Estética (501-514) ---
  s("501", "Estética", "É gestante? Quantos meses?", ["Não", "Sim - 1º trimestre", "Sim - 2º trimestre", "Sim - 3º trimestre"]),
  s("502", "Estética", "Possui filhos? Quantos?", ["Não", "1", "2", "3 ou mais"]),
  s("503", "Estética", "Está exposto ao sol com frequência?", ["Nunca", "Ocasionalmente", "Frequentemente"]),
  s("504", "Estética", "Utiliza lentes de contato?", SIM_NAO),
  s("505", "Estética", "Utiliza filtro solar com frequência?", ["Sempre", "Frequentemente", "Ocasionalmente", "Nunca"]),
  t("506", "Estética", "Utiliza cosméticos? Quais?"),
  t("507", "Estética", "Possui lesões ou problemas na pele? Qual?"),
  t("508", "Estética", "Possui lesões ou problemas nas unhas? Qual?"),
  t("509", "Estética", "Possui problemas de cabelo? Qual?"),
  t("510", "Estética", "Possui cirurgia plástica estética? Qual?"),
  t("511", "Estética", "Possui cirurgia reparadora? Qual?"),
  t("512", "Estética", "Possui implante dentário? Qual?"),
  t("513", "Estética", "Possui tratamento dermatológico/estético? Qual?"),
  t("514", "Estética", "Possui tratamento estético anterior? Qual?"),

  // --- Par-Q (601-607) ---
  s("601", "Par-Q", "Alguma vez seu médico lhe disse que você tem algum problema cardíaco e que só deve fazer atividade física recomendada por um médico?", SIM_NAO),
  s("602", "Par-Q", "Neste último mês, você teve dores no peito quando não estava fazendo atividade física?", SIM_NAO),
  s("603", "Par-Q", "Seu médico já recomendou o uso de algum remédio (por exemplo: diuréticos) para sua pressão arterial ou coração ou condição cardiovascular?", SIM_NAO),
  s("604", "Par-Q", "Você perdeu o equilíbrio em virtude de tonturas ou perdeu a consciência quando estava praticando atividade física?", SIM_NAO),
  s("605", "Par-Q", "Você sente dor no peito quando faz atividade física?", SIM_NAO),
  s("606", "Par-Q", "Você tem algum problema ósseo ou articular (por exemplo: costas, joelho ou quadril) que possa piorar com a prática de atividades físicas?", SIM_NAO),
  s("607", "Par-Q", "Você tem conhecimento de alguma outra razão que contraindique a prática de atividade física?", SIM_NAO),

  // --- Aha (651-678) ---
  s("651", "Aha", "Você tem ou já teve um ataque cardíaco?", SIM_NAO),
  s("652", "Aha", "Você tem ou já teve um colapso cardíaco?", SIM_NAO),
  s("653", "Aha", "Você tem ou já teve um implante de marcapasso?", SIM_NAO),
  s("654", "Aha", "Você tem ou já teve um transplante cardíaco?", SIM_NAO),
  s("655", "Aha", "Você tem ou já teve uma angioplastia coronária?", SIM_NAO),
  s("656", "Aha", "Você tem ou já teve uma cateterização cardíaca?", SIM_NAO),
  s("657", "Aha", "Você tem ou já teve uma cirurgia cardíaca?", SIM_NAO),
  s("658", "Aha", "Você tem ou já teve uma desfibrilação ou distúrbio de ritmo cardíaco?", SIM_NAO),
  s("659", "Aha", "Você tem ou já teve uma doença cardíaca congênita?", SIM_NAO),
  s("660", "Aha", "Você tem ou já teve uma doença da válvula cardíaca?", SIM_NAO),
  s("661", "Aha", "Você já teve desconforto no peito com o esforço?", SIM_NAO),
  s("662", "Aha", "Você já teve falta de ar súbita?", SIM_NAO),
  s("663", "Aha", "Você já teve tonturas, desmaios ou perda de sentidos?", SIM_NAO),
  s("664", "Aha", "Você usa ou já usou medicação para o coração?", SIM_NAO),
  s("665", "Aha", "Você já sentiu queimação ou cãibras musculares?", SIM_NAO),
  s("666", "Aha", "Você possui alguma doença da tireoide, dos rins ou fígado?", SIM_NAO),
  s("667", "Aha", "Você possui asma ou doença pulmonar?", SIM_NAO),
  s("668", "Aha", "Você tem algum problema musculoesquelético?", SIM_NAO),
  s("669", "Aha", "Você tem alguma prescrição para medicamentos?", SIM_NAO),
  s("670", "Aha", "Você tem diabetes?", SIM_NAO),
  s("671", "Aha", "Você tem preocupações quanto a segurança de se exercitar?", SIM_NAO),
  s("672", "Aha", "O seu pai ou irmão (antes dos 55 anos) ou mãe e irmã (antes de 65 anos), teve/tiveram um ataque cardíaco ou fez/fizeram uma cirurgia cardíaca?", SIM_NAO),
  s("673", "Aha", "Seu açúcar sanguíneo é superior ao ideal?", SIM_NAO),
  s("674", "Aha", "Seu colesterol sanguíneo é superior a 200 mg/dl?", SIM_NAO),
  s("675", "Aha", "Sua pressão arterial é superior a 140/90 mmHg?", SIM_NAO),
  s("676", "Aha", "Você está mais que 9kg/19lb acima do seu peso ideal?", SIM_NAO),
  s("677", "Aha", "Você faz menos que 120 min por semana de atividades físicas moderadas (que levem a um discreto aumento da respiração)?", SIM_NAO),
  s("678", "Aha", "Você fuma ou parou de fumar há menos de 6 meses?", SIM_NAO),

  // --- Geral (951-956) ---
  t("951", "Geral", "Qual é a sua Nutricionista/Nutrólogo? (Nome e telefone)"),
  t("952", "Geral", "Qual é o seu contato em caso de emergência? (Nome e telefone)"),
  t("953", "Geral", "Qual é o seu contato médico? (Nome e telefone)"),
  t("954", "Geral", "Qual é o seu Convênio Médico? (Nome e telefone)"),
  t("955", "Geral", "Informações adicionais:"),
  t("956", "Geral", "Comentários e observações do Profissional/Avaliador:"),
];