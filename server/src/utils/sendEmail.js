const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  console.log('Attempting to send email to:', to);

  const emailUser = String(process.env.EMAIL_USER || '').trim();
  const emailPass = String(process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '').trim();

  if (!emailUser || !emailPass) {
    const missing = [];
    if (!emailUser) missing.push('EMAIL_USER');
    if (!emailPass) missing.push('EMAIL_PASS (or EMAIL_PASSWORD)');
    throw new Error(`Email is not configured. Missing: ${missing.join(', ')}`);
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpPortRaw = String(process.env.SMTP_PORT || '').trim();
  const smtpSecureRaw = String(process.env.SMTP_SECURE || '').trim();

  const transporter = nodemailer.createTransport(
    smtpHost
      ? {
          host: smtpHost,
          port: smtpPortRaw ? Number(smtpPortRaw) : 587,
          secure: smtpSecureRaw ? smtpSecureRaw === 'true' : false,
          auth: { user: emailUser, pass: emailPass }
        }
      : {
          service: 'gmail',
          auth: { user: emailUser, pass: emailPass }
        }
  );

  try {
    if (process.env.NODE_ENV !== 'production') {
      const ok = await transporter.verify();
      console.log('Email transporter verify:', ok);
    }

    const info = await transporter.sendMail({
      from: `"Psych Platform" <${emailUser}>`,
      to,
      subject,
      html
    });
    console.log('Email sent successfully:', info.messageId);
  } catch (err) {
    console.error('Email error:', err.message);
    throw err;
  }
};

module.exports = sendEmail;
