import jwt from 'jsonwebtoken';

// Valida o JWT enviado no header Authorization: Bearer <token>.
// Em caso de sucesso popula req.user = { id, tenant_id, role }.
export default function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      tenant_id: payload.tenant_id,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
