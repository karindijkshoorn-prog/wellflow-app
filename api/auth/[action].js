import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';

function generateToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
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

  return res.status(404).json({ error: 'Not found.' });
}
