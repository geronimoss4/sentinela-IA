const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

// Health check para o Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [], 
      tv_chamada: null,
      tv_historico: []
    };
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.tv_chamada) db.tv_chamada = null;
  if (!db.tv_historico) db.tv_historico = [];
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// LOGIN
app.post("/login", (req, res) => {
  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({ erro: "Login inválido" });
  }

  res.json(user);
});

// ATENDIMENTO - cadastrar paciente
app.post("/atendimento", (req, res) => {
  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);
  writeDB(db);

  res.json(paciente);
});

// LISTAR PACIENTES (triagem busca quem foi cadastrado no atendimento)
app.get("/pacientes", (req, res) => { 
  const db = readDB();
  res.json(db.pacientes);
});


// Apoio à decisão clínica baseado em regras transparentes (não é diagnóstico médico).
// Por segurança, não prescreve medicamentos nem calcula doses automaticamente.
function gerarAvaliacaoIA({ sintoma, temperatura, alergia, observacao, risco }) {
  const sintomas = {
    infarto: { nivel: "vermelho", motivo: "suspeita de infarto é um sinal de emergência potencial", acao: "Acionar imediatamente o protocolo de emergência e avaliação médica; não deixar o paciente sozinho." },
    avc: { nivel: "vermelho", motivo: "suspeita de AVC pode exigir intervenção imediata", acao: "Acionar imediatamente o protocolo de emergência, registrar o horário de início dos sintomas se conhecido e não oferecer alimentos ou líquidos." },
    convulsao: { nivel: "vermelho", motivo: "convulsão pode comprometer a segurança e a respiração", acao: "Proteger contra traumas, afastar objetos, não conter os movimentos nem colocar nada na boca; acionar equipe de emergência, especialmente se prolongada ou recorrente." },
    hemorragia: { nivel: "vermelho", motivo: "hemorragia pode causar perda significativa de sangue", acao: "Acionar imediatamente a equipe de emergência e aplicar pressão direta com material limpo se apropriado e sem risco para quem presta ajuda." },
    falta_ar_grave: { nivel: "vermelho", motivo: "falta de ar grave pode indicar comprometimento respiratório", acao: "Acionar imediatamente a equipe de emergência, manter o paciente em posição confortável e monitorar respiração e consciência." },
    falta_ar_moderada: { nivel: "amarelo", motivo: "falta de ar requer avaliação clínica e observação", acao: "Priorizar avaliação profissional, verificar sinais vitais e reclassificar imediatamente se houver piora." },
    febre: { nivel: "amarelo", motivo: "febre pode exigir investigação conforme intensidade, duração e contexto clínico", acao: "Avaliar sinais vitais, hidratação, duração da febre e sinais de alerta; encaminhar para avaliação profissional." },
    vomito: { nivel: "amarelo", motivo: "vômitos podem causar desidratação e ter diversas causas", acao: "Avaliar frequência, capacidade de ingerir líquidos e sinais de desidratação; orientar pequenos goles de líquidos apenas se a pessoa estiver alerta e puder engolir com segurança." },
    diarreia: { nivel: "amarelo", motivo: "diarreia pode levar à desidratação, especialmente se intensa ou persistente", acao: "Avaliar sinais de desidratação e presença de sangue ou dor intensa; considerar solução de reidratação oral quando apropriado e segura." },
    dor_leve: { nivel: "verde", motivo: "dor descrita como leve, sem outros sinais de alerta informados", acao: "Avaliação conforme protocolo local, observação da evolução e orientação para comunicar piora ou novos sintomas." },
    resfriado: { nivel: "verde", motivo: "sintomas compatíveis com quadro respiratório leve, conforme dados limitados da triagem", acao: "Repouso, ingestão de líquidos se tolerada, higiene das mãos e observação; procurar avaliação se houver piora ou dificuldade respiratória." },
    coriza: { nivel: "verde", motivo: "coriza isolada geralmente não indica emergência, mas os dados são limitados", acao: "Higiene nasal e das mãos, hidratação habitual e observação de sinais de piora." },
    tosse: { nivel: "verde", motivo: "tosse isolada não define a causa nem a gravidade", acao: "Investigar duração e sintomas associados; procurar avaliação urgente se houver falta de ar, dor torácica, confusão ou coloração azulada." }
  };
  const t = temperatura === null || temperatura === undefined || temperatura === "" ? NaN : Number(temperatura);
  let item = sintomas[sintoma] || { nivel: "verde", motivo: "informações insuficientes para estimar a gravidade com segurança", acao: "Completar a avaliação clínica e os sinais vitais conforme protocolo institucional; não usar esta sugestão para descartar riscos." };
  let nivel = item.nivel;
  let motivo = item.motivo;
  let acao = item.acao;
  if (Number.isFinite(t) && t >= 39) {
    nivel = "vermelho";
    motivo = `temperatura informada de ${t} °C, considerada sinal de alerta neste protocolo simplificado, junto dos demais dados clínicos`;
    acao = "Solicitar avaliação clínica imediata, verificar sinais vitais completos e aplicar o protocolo institucional de febre; a temperatura isolada não determina diagnóstico.";
  } else if (Number.isFinite(t) && t >= 38 && nivel === "verde") {
    nivel = "amarelo";
    motivo = `temperatura informada de ${t} °C associada à necessidade de avaliação da febre`;
    acao = "Avaliar duração da febre, sinais vitais, hidratação e sinais de alerta; encaminhar para avaliação profissional.";
  }
  // A classificação automatizada pode elevar a prioridade, nunca reduzir um risco informado.
  const ordem = { verde: 1, amarelo: 2, vermelho: 3 };
  if (ordem[risco] && ordem[risco] > ordem[nivel]) { nivel = risco; motivo += "; prioridade mantida conforme classificação de triagem registrada"; }
  return {
    titulo: "Apoio à decisão clínica — avaliação automatizada",
    prioridadeSugerida: nivel,
    justificativa: motivo,
    intervencaoSugerida: acao,
    cuidadosGerais: nivel === "vermelho" ? "Não atrasar atendimento para seguir esta sugestão. Monitorar conforme protocolo e acionar a equipe responsável imediatamente." : "Repouso conforme tolerância, hidratação habitual se segura e acompanhamento da evolução; buscar atendimento urgente diante de piora ou sinais de alerta.",
    alertas: [alergia ? `Alergia informada: ${alergia}. Confirmar substância e reação antes de qualquer medicamento.` : "Alergias não informadas: confirmar antes de qualquer medicamento.", observacao ? `Observação registrada: ${observacao}` : "Sem observações adicionais registradas."],
    medicamento: "Nenhum medicamento ou dose é recomendado automaticamente. A decisão depende de avaliação profissional, idade, peso, alergias, histórico, contraindicações e protocolos locais.",
    aviso: "Ferramenta de apoio baseada em regras simples; não estabelece diagnóstico, não substitui avaliação profissional e pode errar. A equipe deve validar a prioridade e a conduta."
  };
}

// TRIAGEM
app.post("/triagem", (req, res) => {
  const db = readDB();

  let risco = req.body.risco;

  if (req.body.temperatura >= 39) {
    risco = "vermelho";
  } else if (req.body.temperatura >= 38) {
    risco = "amarelo";
  } else if (!risco) {
    risco = "verde";
  }

  const avaliacaoIA = gerarAvaliacaoIA({
    sintoma: req.body.sintoma, temperatura: req.body.temperatura,
    alergia: req.body.alergia, observacao: req.body.observacao, risco
  });
  // A IA pode elevar a prioridade, mas não rebaixa uma classificação de risco já informada.
  const ordemRisco = { verde: 1, amarelo: 2, vermelho: 3 };
  if ((ordemRisco[avaliacaoIA.prioridadeSugerida] || 0) > (ordemRisco[risco] || 0)) risco = avaliacaoIA.prioridadeSugerida;
  const triagem = {
    id: Date.now(),
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    avaliacaoIA: { ...avaliacaoIA, prioridadeSugerida: risco, geradaEm: new Date().toISOString() },
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens.push(triagem);
  writeDB(db);

  res.json(triagem);
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});

// DADOS DE UMA TRIAGEM PARA ABRIR A CONSULTA MÉDICA
app.get("/triagem/:id", (req, res) => {
  const db = readDB();
  const triagem = db.triagens.find(t => String(t.id) === String(req.params.id));
  if (!triagem) return res.status(404).json({ erro: "Triagem não encontrada" });

  const paciente = db.pacientes.find(p => p.nome && triagem.nome && p.nome.trim().toLowerCase() === triagem.nome.trim().toLowerCase());
  res.json({
    ...triagem,
    cpf: paciente?.cpf || triagem.cpf || "",
    avaliacaoIA: triagem.avaliacaoIA || gerarAvaliacaoIA(triagem)
  });
});

// ============ MÍDIA INDOOR - TV ============

// Função criada para enviar a chamada do paciente para a tela da TV.
// Serve para triagem chamar o paciente no guichê e para o médico chamar no consultório.
app.post("/tv/chamar", (req, res) => {
  const db = readDB();

  const chamada = {
    id: Date.now().toString(),
    localTipo: req.body.localTipo,
    localNumero: req.body.localNumero,
    paciente: req.body.paciente,
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  };

  db.tv_chamada = chamada;
  db.tv_historico.unshift(chamada);
  if (db.tv_historico.length > 5) db.tv_historico.pop();

  writeDB(db);
  res.json(chamada);
});

// Função criada para consultar a chamada atual e o histórico que será exibido na TV.
// Essa rota é usada para atualizar a tela automaticamente a cada poucos segundos.
app.get("/tv/chamada", (req, res) => {
  const db = readDB();
  res.json({
    chamada: db.tv_chamada,
    historico: db.tv_historico
  });
});

// LISTA DE MEDICAÇÕES
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// CONSULTA MÉDICA
app.post("/consulta", (req, res) => {
  const db = readDB();

  if (!req.body.paciente || !req.body.medico || !req.body.dataConsulta) {
    return res.status(400).json({ erro: "Paciente, médico e data da consulta são obrigatórios." });
  }

  const consulta = {
    id: Date.now(),
    triagemId: req.body.triagemId || null,
    paciente: req.body.paciente,
    cpf: req.body.cpf || "",
    dataConsulta: req.body.dataConsulta,
    medico: req.body.medico,
    crm: req.body.crm || "",
    pressao: req.body.pressao || "",
    frequencia: req.body.frequencia || "",
    saturacao: req.body.saturacao || "",
    queixa: req.body.queixa || "",
    historico: req.body.historico || "",
    exame: req.body.exame || "",
    diagnostico: req.body.diagnostico || "",
    medicacao: req.body.medicacao || "",
    posologia: req.body.posologia || "",
    orientacoes: req.body.orientacoes || "",
    retorno: req.body.retorno || "",
    destino: req.body.destino || "Alta médica",
    obs: req.body.obs || "",
    avaliacaoIA: req.body.avaliacaoIA || null,
    assinatura: Array.isArray(req.body.assinatura) ? req.body.assinatura : [],
    createdAt: new Date()
  };

  if (consulta.triagemId) {
    const triagem = db.triagens.find(t => String(t.id) === String(consulta.triagemId));
    if (triagem) {
      consulta.avaliacaoIA = triagem.avaliacaoIA || null;
      triagem.status = consulta.destino === "Alta médica" ? "alta" : "atendido";
    }
  }
  db.consultas.push(consulta);

  writeDB(db);
  res.json(consulta);
});

// MEDICAÇÕES
app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.consultas);
});

// START
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});