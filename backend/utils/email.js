import nodemailer from 'nodemailer';

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function enviarEmailResetSenha(email, nome, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = `${frontendUrl}/redefinir-senha?token=${token}`;

  await getTransport().sendMail({
    from: process.env.EMAIL_FROM || 'nottação <noreply@nottacao.com>',
    to: email,
    subject: 'Redefinição de senha — nottação',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0A67E2;margin:0 0 8px">Redefinir senha</h2>
        <p style="color:#475569;margin:0 0 24px">Olá, <strong>${nome}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <a href="${link}"
           style="display:inline-block;background:linear-gradient(135deg,#0096EF,#0A67E2);color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:15px">
          Redefinir minha senha
        </a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0">
          Este link expira em <strong>1 hora</strong>. Se você não solicitou isso, ignore este e-mail.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#cbd5e1;font-size:12px;margin:0">nottação · Sistema para borracharias</p>
      </div>
    `,
  });
}

export async function enviarEmailBoasVindas(email, nome, nomeEmpresa) {
  await getTransport().sendMail({
    from: process.env.EMAIL_FROM || 'nottação <noreply@nottacao.com>',
    to: email,
    subject: `Bem-vindo ao nottação, ${nomeEmpresa}!`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0A67E2;margin:0 0 8px">Conta ativada! 🎉</h2>
        <p style="color:#475569;margin:0 0 16px">Olá, <strong>${nome}</strong>! Sua assinatura da <strong>${nomeEmpresa}</strong> foi confirmada e sua conta já está ativa.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
           style="display:inline-block;background:linear-gradient(135deg,#0096EF,#0A67E2);color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:15px">
          Acessar minha conta
        </a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0">
          Em caso de dúvidas, responda este e-mail.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#cbd5e1;font-size:12px;margin:0">nottação · Sistema para borracharias</p>
      </div>
    `,
  });
}
