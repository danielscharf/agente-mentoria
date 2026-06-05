// api/relatorio.js — CommonJS (compatível com Vercel sem package.json)
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args)).catch(() => globalThis.fetch(...args));

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
    if (!r.ok) return res.status(404).json({ error: 'Registro não encontrado' });
    const data = await r.json();
    fields = data.fields;
  } catch(e) {
    return res.status(500).json({ error: 'Erro Airtable: ' + e.message });
  }

  // 2. Normaliza scores
  const DIMS = {
    D1:{nome:'Solidez Interna',tecnico:'Auto-organização do Self',papel:'FUNDAMENTO'},
    D2:{nome:'Propósito Ativo',tecnico:'Direção de Sentido',papel:'Diagnóstico'},
    D3:{nome:'Controle Emocional',tecnico:'Governança Emocional e Motivacional',papel:'Diagnóstico'},
    D4:{nome:'Sombras Evolutivas',tecnico:'Sombras Evolutivas',papel:'Diagnóstico'},
    D5:{nome:'Ruído Mental',tecnico:'Interferência Cognitiva',papel:'Diagnóstico'},
    D6:{nome:'Autoria Consciente',tecnico:'Senso de Agência',papel:'ATIVADOR'},
    D7:{nome:'Capacidade de Retomada',tecnico:'Flexibilidade Evolutiva',papel:'Diagnóstico'},
    D8:{nome:'Ecossistema Evolutivo',tecnico:'Ecossistema Relacional',papel:'Diagnóstico'},
    D9:{nome:'Vitalidade',tecnico:'Vitalidade',papel:'Base biológica'},
  };

  function nivel(s){ return s>=70?'propulsor':s>=50?'atencao':'teto'; }

  const dimensoes = {};
  for(const [k,m] of Object.entries(DIMS)){
    const score = Number(fields[k]||0);
    dimensoes[k] = {...m, score, nivel:nivel(score)};
  }

  const nome  = fields.Nome || fields.Name || 'Participante';
  const email = fields.Email || '';
  const par   = fields.Par || '—';
  const QoE   = Number(fields.QoE||0);
  const data  = fields.DataCriacao || new Date().toISOString();

  // 3. Gera com Claude
  const scoresStr = Object.entries(dimensoes)
    .map(([k,d])=>`${k} ${d.nome} [${d.papel}]: ${d.score}/100 — ${d.nivel.toUpperCase()}`)
    .join('\n');

  let gerado = { descricaoGeral:'', dimensoes:{}, tetos:[], binarios:[] };
  try {
    const cr = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': CLAUDE,
        'anthropic-version':'2023-06-01'
      },
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:2500,
        system:`Você é o sistema de interpretação da Evoluabilidade™ de Daniel Scharf. Gere descrições comportamentais clínicas e precisas. Tom direto, sem coaching motivacional. Português brasileiro. D1=FUNDAMENTO, D6=ATIVADOR, D4/D5=interferência (score alto=pior). Escala 0-100: ≥70 propulsor, 50-69 atenção, <50 teto. Retorne SOMENTE JSON válido sem markdown.`,
        messages:[{role:'user',content:`Nome: ${nome}\nPar: ${par}\n\nScores:\n${scoresStr}\n\nQoE: ${QoE}/100\n\nRetorne este JSON:\n{"descricaoGeral":"2-3 frases do perfil geral","dimensoes":{"D1":{"descricao":"texto 2-3 frases","nivel":"propulsor|atencao|teto"},"D2":{"descricao":"","nivel":""},"D3":{"descricao":"","nivel":""},"D4":{"descricao":"","nivel":""},"D5":{"descricao":"","nivel":""},"D6":{"descricao":"","nivel":""},"D7":{"descricao":"","nivel":""},"D8":{"descricao":"","nivel":""},"D9":{"descricao":"","nivel":""}},"tetos":[{"nome":"nome curto","descricao":"2 frases","dimensoes":["D1"]}],"binarios":[{"pergunta":"Esta semana, eu [ação]?","frequencia":"Diário","dimensao":"D1","impacto":"1 frase"}]}`}]
      })
    });
    const cd = await cr.json();
    const raw = cd.content?.[0]?.text || '{}';
    gerado = JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch(e) {
    gerado.descricaoGeral = 'Erro ao gerar: ' + e.message;
  }

  return res.status(200).json({ id, nome, email, par, data, QoE, dimensoes, gerado,
    meta:{ versao:'beta-1.0', nota:'Leitura interpretativa exploratória — instrumento em validação.' }
  });
};
