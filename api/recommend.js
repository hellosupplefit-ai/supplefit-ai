import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { profile, gymSlug } = req.body;

    // Fetch gym's products if gymSlug provided
    let gymProducts = [];
    let gymName = 'SuppleFit AI';

    if (gymSlug) {
      const { data: gym } = await supabase
        .from('gyms')
        .select('id, name')
        .eq('slug', gymSlug)
        .single();

      if (gym) {
        gymName = gym.name;
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .eq('gym_id', gym.id);
        gymProducts = products || [];
      }
    }

    // Build product context for AI
    const productContext = gymProducts.length > 0
      ? `\n\nThis gym sells these specific products. Where possible, recommend these exact products:\n${gymProducts.map(p => `- ${p.supplement_type}: "${p.product_name}" (buy: ${p.buy_url})`).join('\n')}`
      : '';

    const randomStyle = [
  "Be conversational and encouraging, like a friendly personal trainer. Use casual language, feel warm and supportive.",
  "Be direct and no-nonsense, like a serious competitive athlete giving advice. Short sentences. No fluff.",
  "Be detailed and scientific, like a sports nutritionist. Use proper terminology and explain the reasoning behind each recommendation.",
  "Be motivating and high energy, like a hype coach. Use exclamation marks, be enthusiastic, make them feel fired up.",
][Math.floor(Math.random() * 4)];

const fullPrompt = profile + productContext + `\n\nIMPORTANT: ${randomStyle} Keep the exact JSON format but let your personality show through in the text fields.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: fullPrompt }]
      })
    });

    const data = await response.json();

    // Save quiz result to database if gym found
    if (gymSlug && gymProducts.length > 0) {
      const { data: gym } = await supabase
        .from('gyms')
        .select('id')
        .eq('slug', gymSlug)
        .single();

      if (gym) {
        await supabase.from('quiz_results').insert({
          gym_id: gym.id,
          answers: req.body.answers || {},
          recommendations: data
        });
      }
    }

    res.status(200).json({ ...data, gymName });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
