import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';
const APP_URL = process.env.APP_URL || 'https://wellflow.karindijkshoorn.com';

function generateToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
}

async function sendResetEmail(toEmail, resetUrl) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Wellflow <noreply@karindijkshoorn.com>',
      to: toEmail,
      subject: 'Reset your Wellflow password',
      html: `<p style="font-family:sans-serif;font-size:15px;color:#1E1714">Hi,</p>
<p style="font-family:sans-serif;font-size:15px;color:#1E1714">We received a request to reset the password for your Wellflow account.</p>
<p style="margin:24px 0"><a href="${resetUrl}" style="background:#7B3F5E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:sans-serif;font-size:14px">Set new password</a></p>
<p style="font-family:sans-serif;font-size:13px;color:#9C8880">This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${body.message || body.name || JSON.stringify(body)}`);
  }
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'signup' && req.method === 'POST') {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required.' });

    const { data: existing } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert([{ name, email, password_hash, generations: 0, subscribed: false }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to create account. ' + error.message });

    const token = generateToken(email);
    return res.status(200).json({
      token,
      user: { name, email, generations: 0, subscribed: false }
    });
  }

  if (action === 'login' && req.method === 'POST') {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required.' });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return res.status(401).json({ error: 'No account found with this email.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });

    const token = generateToken(email);
    return res.status(200).json({
      token,
      user: { name: user.name, email, generations: user.generations, subscribed: user.subscribed }
    });
  }

  if (action === 'me' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Not authenticated.' });

    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);

      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('email', decoded.email)
        .single();

      if (!user) return res.status(401).json({ error: 'User not found.' });

      return res.status(200).json({
        name: user.name,
        email: user.email,
        generations: user.generations,
        subscribed: user.subscribed
      });
    } catch(e) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  }

  if (action === 'reset-request' && req.method === 'POST') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await supabase.from('password_reset_tokens').insert([{ email, token, expires_at }]);

      const resetUrl = `${APP_URL}/reset-password.html?token=${token}`;
      try {
        await sendResetEmail(email, resetUrl);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Always return success — don't reveal whether the email exists
    return res.status(200).json({ ok: true });
  }

  if (action === 'reset-confirm' && req.method === 'POST') {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const { data: record } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (!record) return res.status(400).json({ error: 'This reset link is invalid or has already been used.' });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });

    const password_hash = await bcrypt.hash(password, 10);
    await supabase.from('users').update({ password_hash }).eq('email', record.email);
    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', record.id);

    return res.status(200).json({ ok: true });
  }

  return res.status(404).json({ error: 'Not found.' });
}
