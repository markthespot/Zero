#!/usr/bin/env tsx

/**
 * Simple test script for Dovecot integration
 * This script tests basic IMAP connectivity without Cloudflare Workers dependencies
 */

import * as net from 'net';

// Test configuration
const testConfig = {
  host: 'localhost',
  port: 143,
  user: 'testuser@localhost',
  password: 'testpass',
};

async function checkServerStatus() {
  console.log('🔍 Checking IMAP server status...\n');
  
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
    
    socket.connect(testConfig.port, testConfig.host);
  });
  
  const imapRunning = await imapCheck;
  console.log(`📬 IMAP (${testConfig.host}:${testConfig.port}): ${imapRunning ? '✅ Running' : '❌ Not accessible'}`);
  
  return imapRunning;
}

async function testImapConnection() {
  console.log('📧 Testing IMAP connection...\n');

  const Imap = (await import('imap')).default;

  return new Promise<void>((resolve, reject) => {
    const imap = new Imap({
      user: testConfig.user,
      password: testConfig.password,
      host: testConfig.host,
      port: testConfig.port,
      tls: false,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    });

    let connected = false;

    imap.once('ready', () => {
      connected = true;
      console.log('✅ IMAP connection successful!');
      
      // Test opening INBOX
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.log(`❌ Failed to open INBOX: ${err.message}`);
        } else {
          console.log(`📬 INBOX opened successfully`);
          console.log(`📊 Total messages: ${box.messages.total}`);
          console.log(`📩 New messages: ${box.messages.new}`);
          console.log(`🔓 Unread messages: ${box.messages.unseen}`);
        }
        
        imap.end();
      });
    });

    imap.once('error', (err) => {
      console.log(`❌ IMAP connection failed: ${err.message}`);
      if (!connected) {
        reject(err);
      }
    });

    imap.once('end', () => {
      console.log('📪 IMAP connection closed');
      resolve();
    });

    try {
      imap.connect();
    } catch (err: any) {
      console.log(`❌ Failed to connect: ${err.message}`);
      reject(err);
    }
  });
}

async function testBasicImapOperations() {
  console.log('🧪 Testing basic IMAP operations...\n');

  const Imap = (await import('imap')).default;

  return new Promise<void>((resolve, reject) => {
    const imap = new Imap({
      user: testConfig.user,
      password: testConfig.password,
      host: testConfig.host,
      port: testConfig.port,
      tls: false,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    });

    imap.once('ready', () => {
      console.log('✅ Connected to IMAP server');
      
      // List mailboxes
      imap.getBoxes((err, boxes) => {
        if (err) {
          console.log(`❌ Failed to list boxes: ${err.message}`);
        } else {
          console.log('📁 Available mailboxes:');
          Object.keys(boxes).forEach(boxName => {
            console.log(`  - ${boxName}`);
          });
        }
        
        // Open INBOX and search for messages
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            console.log(`❌ Failed to open INBOX: ${err.message}`);
            imap.end();
            return;
          }
          
          console.log(`\n📬 INBOX details:`);
          console.log(`  - Total messages: ${box.messages.total}`);
          console.log(`  - New messages: ${box.messages.new}`);
          console.log(`  - Unread messages: ${box.messages.unseen}`);
          
          if (box.messages.total > 0) {
            // Search for all messages
            imap.search(['ALL'], (err, results) => {
              if (err) {
                console.log(`❌ Search failed: ${err.message}`);
              } else {
                console.log(`🔍 Found ${results.length} messages`);
                if (results.length > 0) {
                  console.log(`📄 Message IDs: ${results.slice(0, 5).join(', ')}${results.length > 5 ? '...' : ''}`);
                }
              }
              imap.end();
            });
          } else {
            console.log('📭 No messages found in INBOX');
            imap.end();
          }
        });
      });
    });

    imap.once('error', (err) => {
      console.log(`❌ IMAP error: ${err.message}`);
      reject(err);
    });

    imap.once('end', () => {
      console.log('📪 IMAP connection closed');
      resolve();
    });

    imap.connect();
  });
}

async function main() {
  console.log('🚀 Testing Dovecot IMAP Integration...\n');
  
  try {
    // Check if server is running
    const serverRunning = await checkServerStatus();
    
    if (!serverRunning) {
      console.log('\n❌ IMAP server is not accessible');
      console.log('💡 Make sure the IMAP server is running:');
      console.log('   docker ps  # Check if container is running');
      console.log('   docker logs test-imap-server  # Check logs');
      process.exit(1);
    }
    
    console.log();
    
    // Test basic connection
    await testImapConnection();
    
    console.log();
    
    // Test IMAP operations
    await testBasicImapOperations();
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
main().catch(console.error);
