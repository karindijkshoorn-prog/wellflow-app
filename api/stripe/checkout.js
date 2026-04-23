import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { users } from './auth/[action].js';

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PRICE_ID = process.env.STRIPE_PRICE_ID; // Your €15/month recurring price ID from Stripe dashboard

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated.' });

  let userEmail;
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    userEmail = decoded.email;
  } catch(e) {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const user = users.get(userEmail);
  if (!user) return res.status(401).json({ error: 'User not found.' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/app.html?subscribed=true`,
      cancel_url: `${process.env.BASE_URL}/app.html`,
    });

    return res.status(200).json({ url: session.url });
  } catch(e) {
    return res.status(500).json({ error: 'Failed to create checkout session: ' + e.message });
  }
}
