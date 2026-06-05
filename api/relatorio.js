// api/relatorio.js — field names matching actual Airtable schema
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID não fornecido' });

  const TOKEN  = process.env.AIRTABLE_TOKEN;
  const BASE   = process.env.AIRTABLE_BASE;
  const TABLE  = process.env.AIRTABLE_TABLE || 'tblNLJiTyCmHBAVBZ';
  const CLAUDE = process.env.ANTHROPIC_API_KEY;

  // 1. Busca no Airtable
  let fields;
  try {
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `Airtable ${r.status}: ${err}` });
    }
    const data = await r.json();
    fields = data.fields;
  } catch(e) {
    return res.status(500).json({ error: 'Erro Airtable: ' + e.message });
  }

  // 2. Helper: tenta múltiplos nomes de campo (suporta "D1" e "D1 Solidez Interna")
  function getField(f, ...keys) {
    for (const k of keys) {
      if (f[k] !== undefined && f[k] !== null && f[k] !== '') return f[k];
    }
    return null;
  }

  // Scores — aceita nome curto OU nome completo conforme seu Airtable
  const scores = {
    D1: Number(getField(fields, 'D1', 'D1 Solidez Interna')              ?? 0),
    D2: Number(getField(fields, 'D2', 'D2 Propósito Ativo')              ?? 0),
    D3: Number(getField(fields, 'D3', 'D3 Controle Emocional',
                                      'D3 Governança Emocional')         ?? 0),
    D4: Number(getField(fields, 'D4', 'D4 Sombras Evolutivas')           ?? 0),
    D5: Number(getField(fields, 'D5', 'D5 Ruído Mental',
                                      'D5 Interferência Cognitiva')      ?? 0),
    D6: Number(getField(fields, 'D6', 'D6 Autoria Consciente',
                                      'D6 Senso de Agência')             ?? 0),
    D7: Number(getField(fields, 'D7', 'D7 Capacidade de Retomada',
                                      'D7 Flexibilidade Evolutiva')      ?? 0),
    D8: Number(getField(fields, 'D8', 'D8 Ecossistema Evolutivo',
                                      'D8 Ecossistema Relacional')       ?? 0),
    D9: Number(getField(fields, 'D9', 'D9 Vitalidade')                   ?? 0),
  };

  const QoE  = Number(getField(fields, 'QoE', 'qoe', 'Qoe') ?? 0);
  const nome = getField(fields, 'Nome', 'Participante', 'Name', 'Cliente') || 'Participante';
  const par  = getField(fields, 'Par', 'Estagio', 'Estágio', 'Nível') || '—';
  const email = getField(fields, 'Email', 'email') || '';
  const data  = getField(fields, 'DataCriacao', 'Data', 'Created', 'data') || new Date().toISOString();

  // 3. Metadados de dimensão
  const DIMS = {
    D1:{nome:'Solidez Interna',       tecnico:'Auto-organização do Self',            papel:'FUNDAMENTO'},
    D2:{nome:'Propósito Ativo',        tecnico:'Direção de Sentido',                  papel:'Diagnóstico'},
    D3:{nome:'Controle Emocional',     tecnico:'Governança Emocional e Motivacional', papel:'Diagnóstico'},
    D4:{nome:'Sombras Evolutivas',     tecnico:'Sombras Evolutivas',                  papel:'Diagnóstico'},
    D5:{nome:'Ruído Mental',           tecnico:'Interferência Cognitiva',             papel:'Diagnóstico'},
    D6:{nome:'Autoria Consciente',     tecnico:'Senso de Agência',                    papel:'ATIVADOR'},
    D7:{nome:'Capacidade de Retomada', tecnico:'Flexibilidade Evolutiva',             papel:'Diagnóstico'},
    D8:{nome:'Ecossistema Evolutivo',  tecnico:'Ecossistema Relacional',              papel:'Diagnóstico'},
    D9:{nome:'Vitalidade',             tecnico:'Vitalidade',                          papel:'Base biológica'},
  };
  function nivel(s){ return s>=70?'propulsor':s>=50?'atencao':'teto'; }
  const dimensoes = {};
  for(const [k,m] of Object.entries(DIMS)){
    dimensoes[k] = {...m, score: scores[k], nivel: nivel(scores[k])};
  }

  // 4. Gera descrições com Claude
  const scoresStr = Object.entries(dimensoes)
    .map(([k,d])=>`${k} ${d.nome} [${d.papel}]: ${d.score}/100 — ${d.nivel.toUpperCase()}`)
    .join('\n');

  let gerado = { descricaoGeral:'', dimensoes:{}, tetos:[], binarios:[] };
  try {
    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: `Você é o sistema de interpretação da Evoluabilidade™ de Daniel Scharf.
Gere descrições comportamentais clínicas, diretas, sem coaching motivacional.
Português brasileiro. D1=FUNDAMENTO (gateway do sistema), D6=ATIVADOR, D4/D5=interferência (score alto=mais interferência=pior).
Escala: ≥70 propulsor · 50-69 atenção · <50 teto.
Retorne SOMENTE JSON válido sem markdown nem texto adicional.`,
        messages:[{ role:'user', content:`Nome: ${typeof nome === 'string' ? nome : JSON.stringify(nome)}\nPar/Estágio: ${par}\nQoE: ${QoE}/100\n\nScores das 9 Dimensões:\n${scoresStr}\n\nRetorne este JSON exato:\n{"descricaoGeral":"2-3 frases do perfil geral","dimensoes":{"D1":{"descricao":"2-3 frases clínicas","nivel":"propulsor|atencao|teto"},"D2":{"descricao":"","nivel":""},"D3":{"descricao":"","nivel":""},"D4":{"descricao":"","nivel":""},"D5":{"descricao":"","nivel":""},"D6":{"descricao":"","nivel":""},"D7":{"descricao":"","nivel":""},"D8":{"descricao":"","nivel":""},"D9":{"descricao":"","nivel":""}},"tetos":[{"nome":"Nome curto do padrão","descricao":"2 frases sobre como se manifesta","dimensoes":["D1","D5"]}],"binarios":[{"pergunta":"Esta semana, eu [ação concreta]?","frequencia":"Diário","dimensao":"D1","impacto":"Por que este binário confronta o teto"}]}`}]
      })
    });
    const cd = await cr.json();
    const raw = (cd.content?.[0]?.text || '{}').replace(/```json|```/g,'').trim();
    gerado = JSON.parse(raw);
  } catch(e) {
    gerado.descricaoGeral = 'Erro na geração: ' + e.message;
  }

  return res.status(200).json({
    id, nome: typeof nome === 'string' ? nome : JSON.stringify(nome),
    email: typeof email === 'string' ? email : '',
    par: typeof par === 'string' ? par : JSON.stringify(par),
    data, QoE, dimensoes, gerado,
    meta:{ versao:'beta-1.0', nota:'Leitura interpretativa exploratória — instrumento em fase de validação de conteúdo.' },
    _debug: { campos_encontrados: Object.keys(fields) } // remove depois de testar
  });
};
