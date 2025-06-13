#!/usr/bin/env tsx

/**
 * Test script for Dovecot integration
 * This script tests the Dovecot mail manager functionality
 */

import { DovecotMailManager } from '../apps/server/src/lib/driver/dovecot';
import type { DovecotConfig } from '../apps/server/src/lib/driver/dovecot';

// Test configuration - adjust these values for your setup
const testConfig: DovecotConfig = {
  auth: {
    userId: 'test-user-id',
    accessToken: 'testpass', // Password for testuser@localhost
    refreshToken: 'not-used',
    email: 'testuser@localhost',
    host: 'localhost',
    port: 143,
    secure: false,
    protocol: 'imap',
    smtpHost: 'localhost',
    smtpPort: 587,
    smtpSecure: false,
  },
};

async function testDovecotConnection() {
  console.log('🧪 Testing Dovecot Integration...\n');

  try {
    // Initialize the manager
    console.log('📧 Initializing Dovecot Mail Manager...');
    const manager = new DovecotMailManager(testConfig);
    console.log('✅ Manager initialized successfully\n');

    // Test basic functionality
    console.log('🔍 Testing basic functionality...');
    
    const scope = manager.getScope();
    console.log(`📋 Scope: ${scope}`);
    
    const userInfo = await manager.getUserInfo();
    console.log(`👤 User Info:`, userInfo);
    
    const aliases = await manager.getEmailAliases();
    console.log(`📮 Email Aliases:`, aliases);
    
    const labels = await manager.getUserLabels();
    console.log(`🏷️  Labels: ${labels.length} found`);
    console.log('✅ Basic functionality tests passed\n');

    // Test IMAP connection and listing
    console.log('📬 Testing IMAP connection...');
    try {
      const listResult = await manager.list({
        folder: 'inbox',
        maxResults: 5,
      });
      
      console.log(`📊 Found ${listResult.threads.length} messages in INBOX`);
      console.log(`🔗 Next page token: ${listResult.nextPageToken || 'None'}`);
      
      if (listResult.threads.length > 0) {
        console.log('📄 First few messages:');
        listResult.threads.slice(0, 3).forEach((thread, index) => {
          console.log(`  ${index + 1}. ID: ${thread.id}`);
        });
        
        // Test getting a specific message
        console.log('\n📖 Testing message retrieval...');
        const messageId = listResult.threads[0].id;
        const messageResult = await manager.get(messageId);
        
        console.log(`📨 Retrieved message with ${messageResult.messages.length} parts`);
        if (messageResult.latest) {
          console.log(`📝 Subject: ${messageResult.latest.subject}`);
          console.log(`👤 From: ${messageResult.latest.sender.name} <${messageResult.latest.sender.email}>`);
          console.log(`📅 Date: ${messageResult.latest.receivedOn}`);
          console.log(`📄 Snippet: ${messageResult.latest.snippet.substring(0, 100)}...`);
        }
      }
      
      console.log('✅ IMAP tests passed\n');
      
    } catch (imapError: any) {
      console.log(`❌ IMAP test failed: ${imapError.message}`);
      console.log('💡 Make sure Dovecot is running: cd dovecot && docker-compose up -d\n');
    }

    // Test SMTP functionality (if configured)
    if (testConfig.auth.smtpHost) {
      console.log('📤 Testing SMTP functionality...');
      try {
        const emailData = {
          to: [{ email: 'alice@localhost', name: 'Alice Test' }],
          subject: `Test Email - ${new Date().toISOString()}`,
          message: `
            <h2>Test Email from Dovecot Integration</h2>
            <p>This is a test email sent via the Dovecot integration at ${new Date().toLocaleString()}.</p>
            <p>If you receive this, the SMTP functionality is working correctly!</p>
            <hr>
            <small>Sent from Zero Email Dovecot Integration Test</small>
          `,
          attachments: [],
          headers: {},
        };

        const sendResult = await manager.create(emailData);
        console.log(`✅ Email sent successfully! Message ID: ${sendResult.id}`);
        console.log('📧 Check alice@localhost inbox for the test email\n');
        
      } catch (smtpError: any) {
        console.log(`❌ SMTP test failed: ${smtpError.message}`);
        console.log('💡 Make sure SMTP is configured and running\n');
      }
    } else {
      console.log('⏭️  SMTP not configured, skipping send test\n');
    }

    console.log('🎉 Dovecot integration test completed!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function checkDovecotStatus() {
  console.log('🔍 Checking Dovecot server status...\n');
  
  try {
    const net = await import('net');
    
    // Check IMAP port
    const imapCheck = new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(testConfig.auth.port, testConfig.auth.host);
    });
    
    const imapRunning = await imapCheck;
    console.log(`📬 IMAP (${testConfig.auth.host}:${testConfig.auth.port}): ${imapRunning ? '✅ Running' : '❌ Not accessible'}`);
    
    // Check SMTP port if configured
    if (testConfig.auth.smtpHost && testConfig.auth.smtpPort) {
      const smtpCheck = new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.connect(testConfig.auth.smtpPort!, testConfig.auth.smtpHost!);
      });
      
      const smtpRunning = await smtpCheck;
      console.log(`📤 SMTP (${testConfig.auth.smtpHost}:${testConfig.auth.smtpPort}): ${smtpRunning ? '✅ Running' : '❌ Not accessible'}`);
    }
    
    console.log();
    
    if (!imapRunning) {
      console.log('💡 To start Dovecot:');
      console.log('   cd dovecot');
      console.log('   docker-compose up -d');
      console.log();
    }
    
  } catch (error: any) {
    console.error('❌ Error checking server status:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status') || args.includes('-s')) {
    await checkDovecotStatus();
  } else {
    await checkDovecotStatus();
    await testDovecotConnection();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
