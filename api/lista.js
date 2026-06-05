// api/lista.js — CommonJS
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const TOKEN     = process.env.AIRTABLE_TOKEN;
  const BASE      = process.env.AIRTABLE_BASE;
  const TABLE     = process.env.AIRTABLE_TABLE || 'tblNLJiTyCmHBAVBZ';
  const ADMIN_KEY = process.env.ADMIN_KEY;

  if (ADMIN_KEY && req.query.key !== ADMIN_KEY)
    return res.status(401).json({ error: 'Não autorizado' });

  try {
    const url = `https://api.airtable.com/v0/${BASE}/${TABLE}?` +
      `fields[]=Nome&fields[]=Email&fields[]=QoE&fields[]=Par&fields[]=DataCriacao&fields[]=Status` +
      `&sort[0][field]=DataCriacao&sort[0][direction]=desc&maxRecords=200`;

    const r = await fetch(url, { headers:{ Authorization:`Bearer ${TOKEN}` } });
    if (!r.ok) throw new Error(await r.text());
    const { records } = await r.json();

    return res.status(200).json({
      total: records.length,
      records: records.map(rec => ({
        id:     rec.id,
        nome:   rec.fields.Nome||'—',
        email:  rec.fields.Email||'—',
        QoE:    rec.fields.QoE||0,
        par:    rec.fields.Par||'—',
        data:   rec.fields.DataCriacao||'',
        status: rec.fields.Status||'pendente'
      }))
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
