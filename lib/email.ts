// lib/email.ts
/**
 * Send email notification using SMTP
 * For production, you should use a service like SendGrid, Resend, or AWS SES
 */

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // If SMTP is configured, use it. Otherwise, log the email.
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_FROM = process.env.SMTP_FROM || 'noreply@imageenhancer.com';

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    // In development, just log the email
    console.log('═══════════════════════════════════════════════');
    console.log('📧 EMAIL NOTIFICATION (SMTP not configured)');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('Body:', options.text);
    console.log('═══════════════════════════════════════════════');
    return;
  }

  try {
    // Use nodemailer if available
    let nodemailer;
    try {
      nodemailer = await import('nodemailer');
    } catch (importError) {
      console.warn('nodemailer not installed. Install it with: npm install nodemailer');
      console.log('Email content logged above. Configure SMTP or install nodemailer to send emails.');
      return;
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: parseInt(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
    });

    console.log(`✅ Email sent to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw - email failures shouldn't break the app
  }
}

/**
 * Send storage limit alert email
 */
export async function sendStorageAlert(
  currentUsage: number,
  limit: number,
  percentage: number
): Promise<void> {
  await sendEmail({
    to: 'ashleyt@gmail.com',
    subject: `⚠️ Supabase Storage Limit Alert - ${percentage.toFixed(1)}% Used`,
    text: `Storage Alert

Your Supabase storage is approaching the free plan limit.

Current Usage: ${(currentUsage / 1024 / 1024).toFixed(2)} MB
Storage Limit: ${(limit / 1024 / 1024).toFixed(2)} MB (1 GB)
Usage Percentage: ${percentage.toFixed(1)}%

Please consider:
1. Upgrading your Supabase plan
2. Running the cleanup job to delete old images
3. Reviewing storage usage in Supabase dashboard

This is an automated alert from Image Enhancer.`,
    html: `
      <h2>Storage Alert</h2>
      <p>Your Supabase storage is approaching the free plan limit.</p>
      <ul>
        <li><strong>Current Usage:</strong> ${(currentUsage / 1024 / 1024).toFixed(2)} MB</li>
        <li><strong>Storage Limit:</strong> ${(limit / 1024 / 1024).toFixed(2)} MB (1 GB)</li>
        <li><strong>Usage Percentage:</strong> ${percentage.toFixed(1)}%</li>
      </ul>
      <p><strong>Please consider:</strong></p>
      <ol>
        <li>Upgrading your Supabase plan</li>
        <li>Running the cleanup job to delete old images</li>
        <li>Reviewing storage usage in Supabase dashboard</li>
      </ol>
      <p><em>This is an automated alert from Image Enhancer.</em></p>
    `,
  });
}

