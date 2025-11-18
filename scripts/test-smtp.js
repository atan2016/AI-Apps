#!/usr/bin/env node

/**
 * Standalone SMTP Test Script
 * Run with: node scripts/test-smtp.js
 */

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

// Simple .env parser
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  console.log(`Looking for .env file at: ${envPath}`);
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found. Using environment variables from system.\n');
    return;
  }
  
  console.log('✅ Found .env file, loading variables...\n');
  const envContent = fs.readFileSync(envPath, 'utf8');
  let loadedCount = 0;
  envContent.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
        if (key.startsWith('SMTP_')) {
          loadedCount++;
        }
      }
    }
  });
  console.log(`Loaded ${loadedCount} SMTP-related variables.\n`);
}

loadEnv();
const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('🧪 SMTP Configuration Test\n');
  console.log('═══════════════════════════════════════════════\n');
  
  // Show what we found in .env
  console.log('📄 Environment Variables Found:');
  const smtpVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  smtpVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      if (varName === 'SMTP_PASS') {
        console.log(`   ${varName}: ✅ Set (${value.length} characters, hidden)`);
      } else {
        console.log(`   ${varName}: ✅ ${value}`);
      }
    } else {
      console.log(`   ${varName}: ❌ Not set`);
    }
  });
  console.log('');

  // Check environment variables
  const config = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };

  console.log('📋 Configuration Check:');
  console.log(`   SMTP_HOST: ${config.host ? '✅ ' + config.host : '❌ Missing'}`);
  console.log(`   SMTP_PORT: ${config.port ? '✅ ' + config.port : '❌ Missing'}`);
  console.log(`   SMTP_USER: ${config.user ? '✅ ' + config.user : '❌ Missing'}`);
  console.log(`   SMTP_PASS: ${config.pass ? '✅ Set (***hidden***)' : '❌ Missing'}`);
  console.log(`   SMTP_FROM: ${config.from || 'Using SMTP_USER'}\n`);

  if (!config.host || !config.port || !config.user || !config.pass) {
    console.log('❌ ERROR: Missing required SMTP configuration!\n');
    console.log('Missing variables:');
    if (!config.host) console.log('   - SMTP_HOST');
    if (!config.port) console.log('   - SMTP_PORT');
    if (!config.user) console.log('   - SMTP_USER');
    if (!config.pass) console.log('   - SMTP_PASS');
    console.log('\n📝 Please add these to your .env file:');
    console.log('   SMTP_HOST=smtp.gmail.com');
    console.log('   SMTP_PORT=587');
    console.log('   SMTP_USER=your-email@gmail.com');
    console.log('   SMTP_PASS=your-app-password');
    console.log('   SMTP_FROM=noreply@yourdomain.com (optional)\n');
    console.log('💡 For Gmail:');
    console.log('   1. Enable 2FA: https://myaccount.google.com/security');
    console.log('   2. Generate App Password: https://myaccount.google.com/apppasswords');
    console.log('   3. Use the 16-character App Password (remove spaces)\n');
    process.exit(1);
  }

  // Create transporter
  console.log('🔧 Creating SMTP transporter...');
  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port),
      secure: parseInt(config.port) === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    console.log('✅ Transporter created successfully\n');
  } catch (error) {
    console.log('❌ Failed to create transporter:', error.message);
    process.exit(1);
  }

  // Test connection
  console.log('🔌 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');
  } catch (error) {
    console.log('❌ SMTP connection failed!\n');
    console.log('Error Details:');
    console.log(`   Type: ${error.code || 'Unknown'}`);
    console.log(`   Message: ${error.message}`);
    if (error.response) {
      console.log(`   Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.log(`   Response Code: ${error.responseCode}`);
    }
    console.log('\n💡 Troubleshooting steps:');
    console.log('   1. Verify SMTP_HOST is correct:');
    console.log('      - Gmail: smtp.gmail.com');
    console.log('      - Outlook: smtp-mail.outlook.com');
    console.log('      - Yahoo: smtp.mail.yahoo.com');
    console.log('   2. Check SMTP_PORT:');
    console.log('      - Port 587 (TLS) - Most common');
    console.log('      - Port 465 (SSL) - Alternative');
    console.log('   3. Verify credentials:');
    console.log('      - SMTP_USER should be your full email address');
    console.log('      - For Gmail: Use App Password, NOT regular password');
    console.log('   4. Test network connectivity:');
    console.log(`      - Try: telnet ${config.host} ${config.port}`);
    console.log('      - If connection fails, your network may block SMTP');
    console.log('   5. Gmail-specific:');
    console.log('      - Enable 2FA: https://myaccount.google.com/security');
    console.log('      - Generate App Password: https://myaccount.google.com/apppasswords');
    console.log('      - Use 16-character password (remove spaces)\n');
    console.log('📖 For more help, see: SMTP_TROUBLESHOOTING.md\n');
    process.exit(1);
  }

  // Send test email
  console.log('📧 Sending test email to ashleyt@gmail.com...');
  try {
    const result = await transporter.sendMail({
      from: config.from,
      to: 'ashleyt@gmail.com',
      subject: '🧪 SMTP Test - Image Enhancer',
      text: `This is a test email to verify SMTP configuration.

If you receive this email, your SMTP settings are working correctly!

Test Details:
- Time: ${new Date().toISOString()}
- SMTP Host: ${config.host}
- SMTP Port: ${config.port}
- From: ${config.from}

Your email notification system is ready to send storage alerts.`,
      html: `
        <h2>🧪 SMTP Test - Image Enhancer</h2>
        <p>This is a test email to verify SMTP configuration.</p>
        <p><strong>If you receive this email, your SMTP settings are working correctly!</strong></p>
        <hr>
        <h3>Test Details:</h3>
        <ul>
          <li><strong>Time:</strong> ${new Date().toISOString()}</li>
          <li><strong>SMTP Host:</strong> ${config.host}</li>
          <li><strong>SMTP Port:</strong> ${config.port}</li>
          <li><strong>From:</strong> ${config.from}</li>
        </ul>
        <p>Your email notification system is ready to send storage alerts.</p>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log('\n📬 Please check your email inbox at ashleyt@gmail.com');
    console.log('   (Also check spam/junk folder if not in inbox)\n');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ SMTP configuration is working correctly!\n');
  } catch (error) {
    console.log('❌ Failed to send test email!\n');
    console.log('Error Details:');
    console.log(`   Type: ${error.code || 'Unknown'}`);
    console.log(`   Message: ${error.message}`);
    if (error.response) {
      console.log(`   Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.log(`   Response Code: ${error.responseCode}`);
    }
    if (error.command) {
      console.log(`   Command: ${error.command}`);
    }
    console.log('\n💡 Troubleshooting steps:');
    console.log('   1. Verify recipient email: ashleyt@gmail.com');
    console.log('   2. Check account permissions:');
    console.log('      - Account not locked or restricted');
    console.log('      - Account has permission to send emails');
    console.log('   3. For Gmail:');
    console.log('      - Must use App Password (not regular password)');
    console.log('      - 2FA must be enabled');
    console.log('   4. Check for rate limits:');
    console.log('      - Some providers limit emails per day');
    console.log('      - Wait a few minutes and try again');
    console.log('   5. Verify SMTP settings match your provider:\n');
    console.log('      Gmail:');
    console.log('        SMTP_HOST=smtp.gmail.com');
    console.log('        SMTP_PORT=587');
    console.log('        SMTP_USER=your-email@gmail.com');
    console.log('        SMTP_PASS=your-16-char-app-password\n');
    console.log('📖 For more help, see: SMTP_TROUBLESHOOTING.md\n');
    process.exit(1);
  }
}

// Run the test
testSMTP().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

