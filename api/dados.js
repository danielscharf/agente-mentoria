// api/dados.js — CommonJS
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const TOKEN   = process.env.AIRTABLE_TOKEN;
  const BASE    = process.env.AIRTABLE_BASE;
  const TABLE   = process.env.AIRTABLE_TABLE || 'tblNLJiTyCmHBAVBZ';
  const WEBHOOK = process.env.MAKE_WEBHOOK_URL;
  const APP_URL = process.env.APP_URL || '';
  const body    = req.body;

  if (!body?.nome || !body?.email)
    return res.status(400).json({ error: 'Nome e e-mail obrigatórios.' });

  // Salva no Airtable
  let recordId;
  try {
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
      method: 'POST',
      headers: { Authorization:`Bearer ${TOKEN}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ fields:{
        Nome: body.nome, Email: body.email,
        D1:Number(body.D1||0), D2:Number(body.D2||0), D3:Number(body.D3||0),
        D4:Number(body.D4||0), D5:Number(body.D5||0), D6:Number(body.D6||0),
        D7:Number(body.D7||0), D8:Number(body.D8||0), D9:Number(body.D9||0),
        QoE:Number(body.QoE||0), IEL:Number(body.IEL||0), IE:Number(body.IE||0),
        Par: body.par||'—', Consentimento: body.consentimento===true||body.consentimento==='true',
        Status:'completo', DataCriacao: new Date().toISOString()
      }})
    });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d));
    recordId = d.id;
  } catch(e) {
    return res.status(500).json({ error: 'Erro Airtable: ' + e.message });
  }

  // Dispara Make.com (async, não bloqueia)
  if (WEBHOOK) {
    fetch(WEBHOOK, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        recordId, nome:body.nome, email:body.email,
        QoE:body.QoE, par:body.par,
        reportUrl:`${APP_URL}/relatorio.html?id=${recordId}`
      })
    }).catch(()=>{});
  }

  return res.status(200).json({
    success:true, id:recordId,
    reportUrl:`/relatorio.html?id=${recordId}`
  });
};
