import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'wellflow-secret-change-this';

const captionTool = {
  name: 'generate_captions',
  description: 'Return exactly three social media captions as structured data.',
  input_schema: {
    type: 'object',
    properties: {
      captions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hook:     { type: 'string', description: 'Opening hook line — stands alone, scroll-stopping' },
            body:     { type: 'string', description: 'Caption body' },
            cta:      { type: 'string', description: 'Soft engagement call to action' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Lowercase hashtags including the # symbol' }
          },
          required: ['hook', 'body', 'cta', 'hashtags']
        }
      }
    },
    required: ['captions']
  }
};

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

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', userEmail)
    .single();

  if (!user) return res.status(401).json({ error: 'User not found.' });

  if (!user.subscribed && user.generations >= 10) {
    return res.status(403).json({ error: 'Free trial limit reached. Please subscribe to continue.' });
  }

  const { topic, modality, postType, audience, tone, platform, clientName, keywords, avoid, image, mediaType } = req.body;

  const platformGuidance = {
    Instagram: 'Instagram: hook grabs in 1-2 lines, body 150-220 words, 3-5 targeted hashtags only',
    Facebook:  'Facebook: conversational and warm, 180-250 words, 3-5 hashtags',
    LinkedIn:  'LinkedIn: professional but human, 200-280 words, 5-8 hashtags, no salesy tone',
    Threads:   'Threads: punchy but not too short, 80-120 words, 3-5 hashtags, conversational'
  };

  const extras = [];
  if (clientName) extras.push(`Business or client name to reference naturally if relevant: ${clientName}`);
  if (keywords)   extras.push(`Keywords to weave in naturally: ${keywords}`);
  if (avoid)      extras.push(`Avoid: ${avoid}`);
  if (image)      extras.push(`Note: captions should reflect and be inspired by the visual content provided.`);

  const promptText = `You are an expert social media copywriter specialising in wellness businesses. Write 3 distinct ${platform} ${postType}s for a ${modality} professional.

${topic ? `Topic/context: ${topic}` : 'Generate captions based on the visual content provided.'}
Audience: ${audience}
Tone: ${tone}
Platform guidance: ${platformGuidance[platform] || platformGuidance.Instagram}
${extras.join('\n')}

Non-negotiable rules:
- No emojis anywhere
- Sentence case only: capitalise the first word of each sentence and proper nouns, lowercase everywhere else
- No dashes anywhere in the text
- Never use the phrases "level up" or "alignment"
- Each caption opens with a strong scroll-stopping hook (first line stands alone)
- Keep captions concise and easy to read, no fluff, no padding
- Body should feel personal and specific, not generic wellness speak
- End with a soft engagement CTA that invites a response, not a direct sign-up push
- Lowercase hashtags only, always
- Never start three options the same way`;

  const userContent = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: promptText }
      ]
    : promptText;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      tools: [captionTool],
      tool_choice: { type: 'tool', name: 'generate_captions' },
      messages: [{ role: 'user', content: userContent }]
    });

    const toolUse = message.content.find(b => b.type === 'tool_use');
    if (!toolUse) throw new Error('No structured response from model');

    await supabase
      .from('users')
      .update({ generations: user.generations + 1 })
      .eq('email', userEmail);

    return res.status(200).json(toolUse.input);
  } catch(e) {
    return res.status(500).json({ error: 'Generation failed: ' + e.message });
  }
}
