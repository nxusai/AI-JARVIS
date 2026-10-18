// Netlify: POST /api/chat → Semago IA (la ruta se define en netlify.toml).
import { handleChat } from '../../server/semago.js';

export default async (req, context) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Bad request' }, { status: 400 }); }
  const { status, body: out } = await handleChat(body, context.ip || 'anon');
  return Response.json(out, { status });
};
