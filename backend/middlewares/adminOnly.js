// Restringe a rota ao dono (role = 'admin'). Use depois do middleware auth.
export default function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas o administrador pode acessar isto' });
  }
  next();
}
