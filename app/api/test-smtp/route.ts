import { NextResponse } from 'next/server';

/**
 * GET /api/test-smtp
 * Detailed SMTP testing endpoint with diagnostics
 */
interface DiagnosticTest {
  test: string;
  status: string;
  message: string;
  error?: string;
  messageId?: string;
  troubleshooting?: string[];
}

interface Diagnostics {
  timestamp: string;
  smtpConfig: {
    host: string;
    port: string;
    user: string;
    pass: string;
    from: string;
  };
  tests: DiagnosticTest[];
}

export async function GET() {
  const diagnostics: Diagnostics = {
    timestamp: new Date().toISOString(),
    smtpConfig: {
      host: process.env.SMTP_HOST ? '✅ Set' : '❌ Missing',
      port: process.env.SMTP_PORT ? `✅ Set (${process.env.SMTP_PORT})` : '❌ Missing',
      user: process.env.SMTP_USER ? '✅ Set' : '❌ Missing',
      pass: process.env.SMTP_PASS ? '✅ Set (***hidden***)' : '❌ Missing',
      from: process.env.SMTP_FROM || 'Using default',
    },
    tests: [] as DiagnosticTest[],
  };

  // Check if all required SMTP settings are present
  const hasAllSettings = 
    process.env.SMTP_HOST && 
    process.env.SMTP_PORT && 
    process.env.SMTP_USER && 
    process.env.SMTP_PASS;

  if (!hasAllSettings) {
    return NextResponse.json({
      success: false,
      message: 'SMTP configuration incomplete',
      diagnostics,
      note: 'Please set all required SMTP environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS',
    }, { status: 400 });
  }

  // Test 1: Check if nodemailer is available
  try {
    const nodemailer = await import('nodemailer');
    diagnostics.tests.push({
      test: 'Nodemailer import',
      status: '✅ Success',
      message: 'Nodemailer is installed and can be imported',
    });
  } catch (error) {
    diagnostics.tests.push({
      test: 'Nodemailer import',
      status: '❌ Failed',
      message: 'Nodemailer is not installed. Run: npm install nodemailer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({
      success: false,
      message: 'Nodemailer not installed',
      diagnostics,
    }, { status: 500 });
  }

  // Test 2: Create transporter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let transporter: any;
  try {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    diagnostics.tests.push({
      test: 'Create transporter',
      status: '✅ Success',
      message: 'SMTP transporter created successfully',
    });
  } catch (error) {
    diagnostics.tests.push({
      test: 'Create transporter',
      status: '❌ Failed',
      message: 'Failed to create SMTP transporter',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({
      success: false,
      message: 'Failed to create SMTP transporter',
      diagnostics,
    }, { status: 500 });
  }

  // Test 3: Verify SMTP connection
  try {
    await transporter.verify();
    diagnostics.tests.push({
      test: 'SMTP connection verification',
      status: '✅ Success',
      message: 'Successfully connected to SMTP server',
    });
  } catch (error) {
    diagnostics.tests.push({
      test: 'SMTP connection verification',
      status: '❌ Failed',
      message: 'Failed to connect to SMTP server',
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: [
        'Check if SMTP_HOST is correct',
        'Verify SMTP_PORT (587 for TLS, 465 for SSL)',
        'Ensure SMTP_USER and SMTP_PASS are correct',
        'For Gmail: Make sure you\'re using an App Password, not your regular password',
        'Check if your network/firewall allows SMTP connections',
      ],
    });
    return NextResponse.json({
      success: false,
      message: 'SMTP connection failed',
      diagnostics,
    }, { status: 500 });
  }

  // Test 4: Send test email
  try {
    const testEmailResult = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'ashleyt@gmail.com',
      subject: '🧪 SMTP Test - Image Enhancer',
      text: `This is a test email to verify SMTP configuration.

If you receive this email, your SMTP settings are working correctly!

Test Details:
- Time: ${new Date().toISOString()}
- SMTP Host: ${process.env.SMTP_HOST}
- SMTP Port: ${process.env.SMTP_PORT}
- From: ${process.env.SMTP_FROM || process.env.SMTP_USER}

Your email notification system is ready to send storage alerts.`,
      html: `
        <h2>🧪 SMTP Test - Image Enhancer</h2>
        <p>This is a test email to verify SMTP configuration.</p>
        <p><strong>If you receive this email, your SMTP settings are working correctly!</strong></p>
        <hr>
        <h3>Test Details:</h3>
        <ul>
          <li><strong>Time:</strong> ${new Date().toISOString()}</li>
          <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
          <li><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</li>
          <li><strong>From:</strong> ${process.env.SMTP_FROM || process.env.SMTP_USER}</li>
        </ul>
        <p>Your email notification system is ready to send storage alerts.</p>
      `,
    });

    diagnostics.tests.push({
      test: 'Send test email',
      status: '✅ Success',
      message: 'Test email sent successfully',
      messageId: testEmailResult.messageId,
    });

    return NextResponse.json({
      success: true,
      message: 'SMTP test completed successfully!',
      diagnostics,
      note: 'Check your email inbox at ashleyt@gmail.com for the test email.',
    });
  } catch (error) {
    diagnostics.tests.push({
      test: 'Send test email',
      status: '❌ Failed',
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: [
        'Verify the recipient email address is correct',
        'Check if your SMTP account has permission to send emails',
        'For Gmail: Ensure "Less secure app access" is enabled OR use App Password',
        'Check SMTP server logs for more details',
      ],
    });
    return NextResponse.json({
      success: false,
      message: 'Failed to send test email',
      diagnostics,
    }, { status: 500 });
  }
}

