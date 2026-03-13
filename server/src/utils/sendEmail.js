const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  console.log('Attempting to send email to:', to);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: '"Psych Platform" <' + process.env.EMAIL_USER + '>',
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