// Vercel serverless function — receives the "Free Case Review" form
// submission from permit-closer.html.
//
// Two things happen, in priority order:
//   1. The lead is saved to Supabase (public.permit_closer_leads). This is
//      the source of truth — if it fails, the visitor sees an error so the
//      lead is never silently lost.
//   2. An email notification is sent via Resend. This is best-effort: if
//      RESEND_API_KEY isn't set or Resend errors, the lead is already safely
//      stored and the visitor still sees success.
//
// Environment variables (Vercel Project Settings → Environment Variables):
//   SUPABASE_URL       — https://<ref>.supabase.co
//   SUPABASE_ANON_KEY  — the public anon/publishable key. Safe to use here:
//                        RLS on permit_closer_leads allows INSERT only, so
//                        this key can write a lead but cannot read any.
//   RESEND_API_KEY     — optional. From resend.com. Without it, leads are
//                        still captured; only the email alert is skipped.

const LEAD_INBOX = 'angelique@majesticpermits.com';
const FROM_ADDRESS = 'The Permit Closer <angelique@majesticpermits.com>';

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, phone, email, address, refnum, county, desc, website } = req.body || {};

  // Honeypot: real users never fill this in — bots often do.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  if (!name || !phone || !email || !address) {
    return res.status(400).json({ error: 'Please fill in name, phone, email, and property address.' });
  }

  // ---- 1. Save the lead (must succeed) ----------------------------------
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
    return res.status(500).json({ error: 'Something went wrong on our end. Please call (561) 888-3805.' });
  }

  try {
    const saved = await fetch(`${SUPABASE_URL}/rest/v1/permit_closer_leads`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        name,
        phone,
        email,
        address,
        county: county || null,
        refnum: refnum || null,
        notes: desc || null,
      }),
    });

    if (!saved.ok) {
      console.error('Supabase insert failed:', saved.status, await saved.text());
      return res.status(500).json({ error: 'Something went wrong on our end. Please call (561) 888-3805.' });
    }
  } catch (err) {
    console.error('Supabase insert threw:', err);
    return res.status(500).json({ error: 'Something went wrong on our end. Please call (561) 888-3805.' });
  }

  // ---- 2. Email notification (best-effort) ------------------------------
  if (process.env.RESEND_API_KEY) {
    const html = `
      <h2 style="margin:0 0 12px;">New Case Review Request — The Permit Closer</h2>
      <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>Property Address</strong></td><td>${escapeHtml(address)}</td></tr>
        <tr><td><strong>County</strong></td><td>${escapeHtml(county || '—')}</td></tr>
        <tr><td><strong>Letter Reference #</strong></td><td>${escapeHtml(refnum || '—')}</td></tr>
        <tr><td valign="top"><strong>Notes</strong></td><td>${escapeHtml(desc || '—')}</td></tr>
      </table>
    `;

    try {
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [LEAD_INBOX],
          reply_to: email,
          subject: `New Case Review Request — ${name}`,
          html,
        }),
      });

      if (!sent.ok) {
        console.error('Resend error:', sent.status, await sent.text());
      }
    } catch (err) {
      console.error('Resend request threw:', err);
    }
  } else {
    console.warn('RESEND_API_KEY not set — lead saved, email alert skipped.');
  }

  return res.status(200).json({ ok: true });
}
