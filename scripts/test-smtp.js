require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  try {
    let transporter;

    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
    } else if (process.env.SMTP_USER && process.env.SMTP_USER.endsWith('@gmail.com') && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
    } else {
      console.error('SMTP não configurado. Defina SMTP_HOST/SMTP_USER/SMTP_PASS no .env ou variáveis de ambiente.');
      process.exit(2);
    }

    console.log('Verificando conexão com SMTP...');
    await transporter.verify();
    console.log('Transporte SMTP verificado com sucesso');

    const to = process.env.TEST_TO || process.env.SMTP_USER;
    const mail = {
      from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `Teste <${process.env.SMTP_USER}>` : 'Teste <noreply@test>'),
      to,
      subject: 'Teste SMTP - Catálogo Interativo',
      text: `Este é um e-mail de teste enviado em ${new Date().toISOString()}`
    };

    const info = await transporter.sendMail(mail);
    console.log('E-mail de teste enviado:', info.response || info);
    process.exit(0);
  } catch (err) {
    console.error('Falha ao enviar e-mail de teste:', err);
    process.exit(1);
  }
}

main();
