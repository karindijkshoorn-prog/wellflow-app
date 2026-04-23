import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';

// Shared in-memory users store (same as auth endpoint)
// In production replace with a real database
import { users } from './auth/[action].js';

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

  // Check usage limits
  if (!user.subscribed && user.generations >= 10) {
    return res.status(403).json({ error: 'Free trial limit reached. Please subscribe to continue.' });
  }

  const { topic, modality, postType, audience, tone, platform, clientName, keywords, avoid, image, mediaType } = req.body;

  const platformGuidance = {
    Instagram: 'Instagram: hook grabs in 1-2 lines, body 80-150 words, 5-8 hashtags',
    Facebook: 'Facebook: slightly longer and more conversational, warmer community feel, 2-3 hashtags max',
    LinkedIn: 'LinkedIn: professional but human, 100-180 words, 3-5 hashtags, no salesy tone',
    Threads: 'Threads: short and punchy, under 80 words, 1-3 hashtags, conversational'
  };

  const extras = [];
  if (clientName) extras.push(`Business or client name to reference naturally if relevant: ${clientName}`);
  if (keywords) extras.push(`Keywords to weave in naturally: ${keywords}`);
  if (avoid) extras.push(`Avoid: ${avoid}`);
  if (image) extras.push(`Note: captions should reflect and be inspired by the visual content provided.`);

  const promptText = `You are an expert social media copywriter specialising in wellness businesses. Write 3 distinct ${platform} ${postType}s for a ${modality} professional.

${topic ? `Topic/context: ${topic}` : 'Generate captions based on the visual content provided.'}
Audience: ${audience}
Tone: ${tone}
Platform guidance: ${platformGuidance[platform] || platformGuidance.Instagram}
${extras.join('\n')}

Non-negotiable rules:
- No emojis anywhere
- Sentence case only, no unnecessary capitals
- No dashes anywhere in the text
- Never use the phrases "level up" or "alignment"
- Each caption opens with a strong scroll-stopping hook (first line stands alone)
- Body should feel personal and specific, not generic wellness speak
- End with a soft engagement CTA that invites a response, not a direct sign-up push
- Lowercase hashtags only, always
- Never start three options the same way

Return ONLY a valid JSON object. No markdown, no backticks, no explanation. Exactly this format:
{"captions":[{"hook":"...","body":"...","cta":"...","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]},{"hook":"...","body":"...","cta":"...","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]},{"hook":"...","body":"...","cta":"...","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}]}`;

  const userContent = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: promptText }
      ]
    : promptText;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: userContent }]
    });

    const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Increment generation count
    user.generations = (user.generations || 0) + 1;

    return res.status(200).json(parsed);
  } catch(e) {
    return res.status(500).json({ error: 'Generation failed: ' + e.message });
  }
}
