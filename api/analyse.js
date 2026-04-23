import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const token = authHeader.replace('Bearer ', '');
    jwt.verify(token, JWT_SECRET);
  } catch(e) {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const { image, mediaType } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided.' });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
          { type: 'text', text: "You are helping a wellness professional create social media captions. Describe what you see in this image in 1-2 sentences to help write a relevant caption. Focus on the activity, setting, mood, and any visible movement or props. Be specific and practical. Do not mention people's names. Keep it under 60 words." }
        ]
      }]
    });

    const description = message.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return res.status(200).json({ description });
  } catch(e) {
    return res.status(500).json({ error: 'Analysis failed: ' + e.message });
  }
}
