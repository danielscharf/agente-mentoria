// api/relatorio.js — Evoluabilidade Assessment Stack
// Busca registro no Airtable + gera descrições comportamentais via Claude

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID do registro não fornecido' });

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
  const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

  // ─── 1. BUSCA NO AIRTABLE ──────────────────────────────────────────────────
  // ATENÇÃO: Verifique os nomes exatos dos campos na sua base.
  // Nome da tabela: ASSESSMENTS — Evoluabilidade (tblNLJiTyCmHBAVBZ)
  const tableId = process.env.AIRTABLE_TABLE || 'tblNLJiTyCmHBAVBZ';
  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${id}`;

  let fields;
  try {
    const r = await fetch(airtableUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(404).json({ error: `Airtable: ${err}` });
    }
    ({ fields } = await r.json());
  } catch (e) {
    return res.status(500).json({ error: `Erro ao buscar Airtable: ${e.message}` });
  }

  // ─── 2. NORMALIZA DADOS ────────────────────────────────────────────────────
  // Adapte os nomes dos campos conforme sua tabela real.
  // D4 (Sombras) e D5 (Ruído Mental) são dimensões de interferência.
  // Se sua pontuação é "alto = mais interferência", inverta: score = 100 - valor
  // Se já está normalizado (alto = melhor), mantenha como está.
  const raw = {
    D1: Number(fields.D1 ?? fields.d1 ?? 0),
    D2: Number(fields.D2 ?? fields.d2 ?? 0),
    D3: Number(fields.D3 ?? fields.d3 ?? 0),
    D4: Number(fields.D4 ?? fields.d4 ?? 0),
    D5: Number(fields.D5 ?? fields.d5 ?? 0),
    D6: Number(fields.D6 ?? fields.d6 ?? 0),
    D7: Number(fields.D7 ?? fields.d7 ?? 0),
    D8: Number(fields.D8 ?? fields.d8 ?? 0),
    D9: Number(fields.D9 ?? fields.d9 ?? 0),
  };

  const DIMENSOES_META = {
    D1: { nome: 'Solidez Interna',        tecnico: 'Auto-organização do Self',             papel: 'FUNDAMENTO', inverso: false },
    D2: { nome: 'Propósito Ativo',         tecnico: 'Direção de Sentido',                   papel: 'Diagnóstico', inverso: false },
    D3: { nome: 'Controle Emocional',      tecnico: 'Governança Emocional e Motivacional',  papel: 'Diagnóstico', inverso: false },
    D4: { nome: 'Sombras Evolutivas',      tecnico: 'Sombras Evolutivas',                   papel: 'Diagnóstico', inverso: false },
    D5: { nome: 'Ruído Mental',            tecnico: 'Interferência Cognitiva',              papel: 'Diagnóstico', inverso: false },
    D6: { nome: 'Autoria Consciente',      tecnico: 'Senso de Agência',                     papel: 'ATIVADOR',    inverso: false },
    D7: { nome: 'Capacidade de Retomada',  tecnico: 'Flexibilidade Evolutiva',              papel: 'Diagnóstico', inverso: false },
    D8: { nome: 'Ecossistema Evolutivo',   tecnico: 'Ecossistema Relacional',               papel: 'Diagnóstico', inverso: false },
    D9: { nome: 'Vitalidade',              tecnico: 'Vitalidade',                           papel: 'Base biológica', inverso: false },
  };

  // Nível de cada dimensão
  function nivel(score) {
    if (score >= 70) return 'propulsor';
    if (score >= 50) return 'atencao';
    return 'teto';
  }

  const dimensoes = {};
  for (const [id, meta] of Object.entries(DIMENSOES_META)) {
    dimensoes[id] = { ...meta, score: raw[id], nivel: nivel(raw[id]) };
  }

  const nome  = fields.Nome || fields.Name || fields.nome || 'Participante';
  const email = fields.Email || fields.email || '';
  const par   = fields.Par || fields.Estagio || fields.estagio || '—';
  const QoE   = Number(fields.QoE ?? fields.qoe ?? 0);
  const data  = fields.Created || fields.DataCriacao || new Date().toISOString();

  // ─── 3. GERA COM CLAUDE ────────────────────────────────────────────────────
  const scoresStr = Object.entries(dimensoes)
    .map(([k, d]) => `${k} ${d.nome} [${d.papel}]: ${d.score}/100 — ${nivel(d.score).toUpperCase()}`)
    .join('\n');

  const systemPrompt = `Você é o sistema de interpretação da Evoluabilidade™ — metodologia de Daniel Scharf sobre capacidade de evolução humana.

MISSÃO: Gerar descrições comportamentais clínicas e precisas baseadas nos escores das 9 Dimensões.
TOM: Direto, profundo, sem coaching motivacional, sem elogios vazios. Como um diagnóstico médico experiente.
IDIOMA: Português brasileiro.

ARQUITETURA DAS DIMENSÕES:
- D1 (Solidez Interna): FUNDAMENTO — organiza todo o sistema. Score baixo = raiz dos sintomas.
- D6 (Autoria Consciente): ATIVADOR — transforma consciência em movimento.
- D4 (Sombras Evolutivas): interferências do passado que hoje limitam o crescimento.
- D5 (Ruído Mental): pensamento repetitivo, ruminação, interferência cognitiva.
- D2–D3, D7–D8: diagnóstico e contexto.
- D9 (Vitalidade): infraestrutura biológica. Sem ela, as outras 8 operam em capacidade reduzida.

ESCALA: 0–100.
- 70–100: PROPULSOR — dimensão ativa, funcionando como alavanca.
- 50–69: ATENÇÃO — zona de oscilação, pode ser propulsor ou teto dependendo do contexto.
- 0–49: TETO — limitador ativo do sistema.

REGRAS DE ESCRITA:
- Descreva o padrão atual, não o potencial.
- Seja específico: o que essa pessoa provavelmente faz, evita ou experimenta.
- Máximo 3 frases por dimensão. Direto ao ponto.
- Tetos: combine as 2–3 dimensões mais baixas para nomear o padrão sistêmico.
- Binários: ações concretas Sim/Não executáveis, alta fricção, que confrontam diretamente os tetos.
- Resposta: JSON puro e válido. SEM markdown, SEM texto fora do JSON.`;

  const userPrompt = `Gere o relatório para: ${nome}

ESCORES DAS 9 DIMENSÕES:
${scoresStr}

QoE Geral: ${QoE}/100
Par Negócio × Empreendedor: ${par}

Retorne SOMENTE este JSON (sem markdown, sem texto adicional):
{
  "descricaoGeral": "2-3 frases sobre o perfil geral desta pessoa baseado no conjunto das dimensões",
  "dimensoes": {
    "D1": { "descricao": "texto clínico 2-3 frases", "nivel": "propulsor|atencao|teto" },
    "D2": { "descricao": "...", "nivel": "..." },
    "D3": { "descricao": "...", "nivel": "..." },
    "D4": { "descricao": "...", "nivel": "..." },
    "D5": { "descricao": "...", "nivel": "..." },
    "D6": { "descricao": "...", "nivel": "..." },
    "D7": { "descricao": "...", "nivel": "..." },
    "D8": { "descricao": "...", "nivel": "..." },
    "D9": { "descricao": "...", "nivel": "..." }
  },
  "tetos": [
    {
      "nome": "Nome curto do padrão de teto (ex: Refúgio Operacional)",
      "descricao": "2 frases explicando como esse teto se manifesta para esta pessoa especificamente",
      "dimensoes": ["D1", "D5"]
    }
  ],
  "binarios": [
    {
      "pergunta": "Esta semana, eu [verbo + ação concreta e específica]?",
      "frequencia": "Diário",
      "dimensao": "D1",
      "impacto": "1 frase de por que este binário confronta o teto"
    }
  ]
}`;

  let gerado;
  try {
    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const cd = await cr.json();
    const raw = cd.content?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    gerado = JSON.parse(clean);
  } catch (e) {
    gerado = {
      descricaoGeral: 'Erro ao gerar descrição. Verifique a chave da API.',
      dimensoes: {},
      tetos: [],
      binarios: [],
    };
  }

  // ─── 4. RETORNA PAYLOAD COMPLETO ───────────────────────────────────────────
  return res.status(200).json({
    id,
    nome,
    email,
    par,
    data,
    QoE,
    dimensoes,
    gerado,
    meta: {
      versao: 'beta-1.0',
      instrumento: 'Assessment de Evoluabilidade — instrumento em fase de validação de conteúdo',
      nota: 'Os resultados constituem uma leitura interpretativa exploratória, não uma medição psicométrica validada.',
    },
  });
}
