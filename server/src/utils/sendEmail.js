const nodemailer = require('nodemailer');

const stripHtml = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const isRetryableEmailError = (err) => {
  const code = String(err?.code || '').toUpperCase();
  const command = String(err?.command || '').toLowerCase();

  // Network/transient conditions where a retry is often successful.
  if (['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code)) return true;
  if (command === 'conn' || command === 'api') return true;

  return false;
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const sendEmail = async ({ to, subject, html, text }) => {
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

    const finalText = typeof text === 'string' ? text : stripHtml(html);

    const maxAttempts = Number(process.env.EMAIL_SEND_RETRIES || 3);
    let lastErr = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const info = await transporter.sendMail({
          from: `"Psych Platform" <${emailUser}>`,
          to,
          subject,
          text: finalText || undefined,
          html: html || undefined
        });
        console.log('Email sent successfully:', info.messageId);
        return;
      } catch (err) {
        lastErr = err;
        console.error(`Email error (attempt ${attempt}/${maxAttempts}):`, err.message);

        if (!isRetryableEmailError(err) || attempt === maxAttempts) {
          throw err;
        }

        await delay(250 * attempt);
      }
    }

    // Should be unreachable, but keep a safe fallback.
    throw lastErr || new Error('Failed to send email');
  } catch (err) {
    console.error('Email error:', err.message);
    throw err;
  }
};

module.exports = sendEmail;
