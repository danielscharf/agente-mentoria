// api/lista.js — Lista todos os assessments para o dashboard admin

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = process.env.AIRTABLE_BASE;
  const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'tblNLJiTyCmHBAVBZ';

  // Autenticação simples: chave de admin via query param
  // Uso: /api/lista?key=SUA_ADMIN_KEY
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (ADMIN_KEY && req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const params = new URLSearchParams({
      'fields[]': ['Nome', 'Email', 'QoE', 'Par', 'DataCriacao', 'Status', 'D1', 'D6', 'D9'],
      sort: JSON.stringify([{ field: 'DataCriacao', direction: 'desc' }]),
      maxRecords: '200',
    });

    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: `Airtable: ${err}` });
    }

    const { records } = await r.json();
    const lista = records.map(rec => ({
      id:     rec.id,
      nome:   rec.fields.Nome || '—',
      email:  rec.fields.Email || '—',
      QoE:    rec.fields.QoE || 0,
      par:    rec.fields.Par || '—',
      data:   rec.fields.DataCriacao || '',
      status: rec.fields.Status || 'pendente',
    }));

    return res.status(200).json({ total: lista.length, records: lista });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
