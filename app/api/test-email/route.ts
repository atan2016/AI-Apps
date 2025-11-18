import { NextResponse } from 'next/server';
import { sendEmail, sendStorageAlert } from '@/lib/email';

/**
 * GET /api/test-email
 * Test endpoint to send a test email notification
 */
export async function GET() {
  try {
    console.log('📧 Testing email notification...');

    // Test 1: Send a simple test email
    await sendEmail({
      to: 'ashleyt@gmail.com',
      subject: '🧪 Test Email from Image Enhancer',
      text: `This is a test email from the Image Enhancer application.

If you receive this email, the email notification system is working correctly!

Time: ${new Date().toISOString()}

The email service is configured and ready to send storage alerts.`,
      html: `
        <h2>🧪 Test Email from Image Enhancer</h2>
        <p>This is a test email from the Image Enhancer application.</p>
        <p><strong>If you receive this email, the email notification system is working correctly!</strong></p>
        <p><em>Time: ${new Date().toISOString()}</em></p>
        <p>The email service is configured and ready to send storage alerts.</p>
      `,
    });

    // Test 2: Send a storage alert email (simulated)
    const testUsage = 900 * 1024 * 1024; // 900 MB
    const testLimit = 1024 * 1024 * 1024; // 1 GB
    const testPercentage = (testUsage / testLimit) * 100;

    await sendStorageAlert(testUsage, testLimit, testPercentage);

    return NextResponse.json({
      success: true,
      message: 'Test emails sent successfully!',
      tests: [
        'Simple test email sent to ashleyt@gmail.com',
        'Storage alert email sent to ashleyt@gmail.com',
      ],
      note: 'Check your email inbox (and spam folder) for the test emails. If SMTP is not configured, check the console logs.',
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test email',
        message: error instanceof Error ? error.message : 'Unknown error',
        note: 'Check your SMTP configuration in .env file. If not configured, emails will be logged to console.',
      },
      { status: 500 }
    );
  }
}

