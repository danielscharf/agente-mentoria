// api/dados.js — Recebe dados do assessment, salva no Airtable, dispara webhook Make.com

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const AIRTABLE_TOKEN  = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE   = process.env.AIRTABLE_BASE;
  const AIRTABLE_TABLE  = process.env.AIRTABLE_TABLE || 'tblNLJiTyCmHBAVBZ';
  const MAKE_WEBHOOK    = process.env.MAKE_WEBHOOK_URL; // Cole a URL do webhook do Make.com

  const body = req.body;

  // ─── Validação básica ──────────────────────────────────────────────────────
  if (!body || !body.nome || !body.email) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  }

  // ─── 1. SALVA NO AIRTABLE ──────────────────────────────────────────────────
  // Campos esperados no body (enviados pelo assessment.html):
  // nome, email, D1, D2, D3, D4, D5, D6, D7, D8, D9, QoE, par, consentimento
  const airtablePayload = {
    fields: {
      Nome:           body.nome,
      Email:          body.email,
      D1:             Number(body.D1 || 0),
      D2:             Number(body.D2 || 0),
      D3:             Number(body.D3 || 0),
      D4:             Number(body.D4 || 0),
      D5:             Number(body.D5 || 0),
      D6:             Number(body.D6 || 0),
      D7:             Number(body.D7 || 0),
      D8:             Number(body.D8 || 0),
      D9:             Number(body.D9 || 0),
      QoE:            Number(body.QoE || 0),
      Par:            body.par || '—',
      Consentimento:  body.consentimento === true || body.consentimento === 'true',
      Status:         'completo',
      DataCriacao:    new Date().toISOString(),
      // Campos para validação futura
      IEL:            Number(body.IEL || 0),
      IE:             Number(body.IE  || 0),
    },
  };

  let recordId;
  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(airtablePayload),
      }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    recordId = data.id;
  } catch (e) {
    return res.status(500).json({ error: `Erro Airtable: ${e.message}` });
  }

  // ─── 2. DISPARA WEBHOOK MAKE.COM ──────────────────────────────────────────
  if (MAKE_WEBHOOK) {
    try {
      await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          nome:  body.nome,
          email: body.email,
          QoE:   body.QoE,
          par:   body.par,
          reportUrl: `${process.env.APP_URL || 'https://SUA-URL.vercel.app'}/relatorio.html?id=${recordId}`,
        }),
      });
    } catch (e) {
      // Webhook falhou mas não bloqueia o fluxo principal
      console.error('Make webhook error:', e.message);
    }
  }

  // ─── 3. RETORNA RECORD ID ─────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    id: recordId,
    reportUrl: `/relatorio.html?id=${recordId}`,
  });
}
