import Stripe from 'stripe';
import { users } from '../auth/[action].js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch(e) {
    return res.status(400).json({ error: 'Webhook signature verification failed.' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;
    if (email && users.has(email)) {
      const user = users.get(email);
      user.subscribed = true;
      user.stripeCustomerId = session.customer;
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    // Find user by stripe customer ID and revoke subscription
    for (const [email, user] of users.entries()) {
      if (user.stripeCustomerId === subscription.customer) {
        user.subscribed = false;
        break;
      }
    }
  }

  return res.status(200).json({ received: true });
}
