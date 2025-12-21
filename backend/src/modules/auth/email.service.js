import nodemailer from 'nodemailer';

let transporter = null;

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

/**
 * Send magic link email
 */
export async function sendMagicLinkEmail(to, name, magicLink) {
  const transporter = getTransporter();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #0066cc; 
          color: #ffffff; 
          text-decoration: none; 
          border-radius: 4px;
          margin: 20px 0;
        }
        .footer { margin-top: 40px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🔐 Your Login Link</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Click the button below to securely log in to your Incident KB account:</p>
        <a href="${magicLink}" class="button">Log In Now</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${magicLink}</p>
        <p><strong>This link expires in 15 minutes.</strong></p>
        <p>If you didn't request this login link, you can safely ignore this email.</p>
        <div class="footer">
          <p>Incident Intelligence Platform<br>
          Knowledge Base SaaS</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: '🔐 Your Login Link - Incident KB',
    html
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(to, name) {
  const transporter = getTransporter();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #0066cc; 
          color: #ffffff; 
          text-decoration: none; 
          border-radius: 4px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🎉 Welcome to Incident KB!</h2>
        <p>Hi ${name},</p>
        <p>Your account has been created successfully. You can now:</p>
        <ul>
          <li>✅ Create and manage Knowledge Base articles</li>
          <li>✅ Track incidents in real-time</li>
          <li>✅ Use AI-powered suggestions</li>
          <li>✅ Collaborate with your team</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}" class="button">Get Started</a>
      </div>
    </body>
    </html>
  `;
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: '🎉 Welcome to Incident KB',
    html
  });
}
