import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — fetch gym + products + quiz count
  if (req.method === 'GET') {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: 'Slug required' });

    const { data: gym } = await supabase.from('gyms').select('*').eq('slug', slug).single();
    if (!gym) return res.status(404).json({ error: 'Gym not found' });

    const { data: products } = await supabase.from('products').select('*').eq('gym_id', gym.id);
    const { count } = await supabase.from('quiz_results').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id);

    return res.status(200).json({ gym, products: products || [], quizCount: count || 0 });
  }

  // POST — create or update gym
  if (req.method === 'POST') {
    const { name, email, slug, logo_url } = req.body;
    if (!name || !email || !slug) return res.status(400).json({ error: 'Missing fields' });

    // Upsert gym
    const { data: gym, error } = await supabase
      .from('gyms')
      .upsert({ name, email, slug, logo_url }, { onConflict: 'slug' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ gym });
  }

  // PUT — add product to gym
  if (req.method === 'PUT') {
    const { gym_id, supplement_type, product_name, buy_url } = req.body;
    if (!gym_id || !supplement_type || !product_name || !buy_url) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({ gym_id, supplement_type, product_name, buy_url })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ product });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
