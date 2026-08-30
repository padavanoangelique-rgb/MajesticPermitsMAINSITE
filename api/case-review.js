// Vercel serverless function — receives the "Free Case Review" form
// submission from permit-closer.html, emails it via Resend to the Zoho
// lead inbox, and saves it to Supabase for a searchable lead list.
//
// Requires these environment variables (Vercel Project Settings →
// Environment Variables):
//   RESEND_API_KEY            — from resend.com
//   SUPABASE_URL              — Project Settings → API in Supabase
//   SUPABASE_SERVICE_ROLE_KEY — same page, the service_role secret
//                                (never the anon/public key — this one
//                                bypasses Row Level Security, so it must
//                                only ever live server-side)
//
// The Supabase table is created by supabase-schema.sql — paste that into
// the Supabase SQL Editor once before this will have anywhere to write.

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

  const sendEmail = fetch('https://api.resend.com/emails', {
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

  // Saving to Supabase is best-effort — if it fails, we still want the
  // email to go out and the homeowner to see success. Only logged, never
  // surfaced to the visitor.
  const saveLead = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    ? fetch(`${process.env.SUPABASE_URL}/rest/v1/permit_closer_leads`, {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
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
      })
    : Promise.resolve(null);

  const [emailResult, leadResult] = await Promise.allSettled([sendEmail, saveLead]);

  if (leadResult.status === 'rejected') {
    console.error('Supabase insert failed:', leadResult.reason);
  } else if (leadResult.value && !leadResult.value.ok) {
    console.error('Supabase insert failed:', await leadResult.value.text());
  }

  if (emailResult.status === 'rejected') {
    console.error('Resend request failed:', emailResult.reason);
    return res.status(502).json({ error: 'Failed to send email.' });
  }

  if (!emailResult.value.ok) {
    const errText = await emailResult.value.text();
    console.error('Resend error:', errText);
    return res.status(502).json({ error: 'Failed to send email.' });
  }

  return res.status(200).json({ ok: true });
}
