// Vercel: POST /api/chat → IA del Abuelito.
import { handleChat } from '../server/abuelito.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Bad request' }); } }
  const { status, body: out } = await handleChat(body, ip);
  res.status(status).json(out);
}
