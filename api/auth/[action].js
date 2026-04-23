import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// In-memory store for demo — replace with a real database (Supabase, PlanetScale, etc.)
// Users are stored as: { email, name, passwordHash, generations, subscribed, stripeCustomerId }
const users = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';

function generateToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'signup' && req.method === 'POST') {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required.' });
    if (users.has(email)) return res.status(400).json({ error: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { name, email, passwordHash, generations: 0, subscribed: false };
    users.set(email, user);
    const token = generateToken(email);
    return res.status(200).json({ token, user: { name, email, generations: 0, subscribed: false } });
  }

  if (action === 'login' && req.method === 'POST') {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required.' });
    const user = users.get(email);
    if (!user) return res.status(401).json({ error: 'No account found with this email.' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });
    const token = generateToken(email);
    return res.status(200).json({ token, user: { name: user.name, email, generations: user.generations, subscribed: user.subscribed } });
  }

  if (action === 'me' && req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Not authenticated.' });
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = users.get(decoded.email);
      if (!user) return res.status(401).json({ error: 'User not found.' });
      return res.status(200).json({ name: user.name, email: user.email, generations: user.generations, subscribed: user.subscribed });
    } catch(e) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  }

  return res.status(404).json({ error: 'Not found.' });
}

export { users, JWT_SECRET };
