import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DovecotMailManager } from '../dovecot';
import type { DovecotConfig } from '../dovecot';

// Test configuration for local Dovecot instance
const testConfig: DovecotConfig = {
  auth: {
    userId: 'test-user-id',
    accessToken: 'testpass', // Using as password for Dovecot
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

describe('DovecotMailManager', () => {
  let manager: DovecotMailManager;

  beforeAll(() => {
    manager = new DovecotMailManager(testConfig);
  });

  afterAll(() => {
    // Cleanup connections if needed
  });

  describe('Basic functionality', () => {
    it('should initialize without errors', () => {
      expect(manager).toBeInstanceOf(DovecotMailManager);
      expect(manager.config).toEqual(testConfig);
    });

    it('should return correct scope', () => {
      const scope = manager.getScope();
      expect(scope).toBe('imap pop3 smtp');
    });

    it('should return user info', async () => {
      const userInfo = await manager.getUserInfo();
      expect(userInfo).toEqual({
        address: 'testuser@localhost',
        name: 'testuser',
        photo: '',
      });
    });

    it('should return email aliases', async () => {
      const aliases = await manager.getEmailAliases();
      expect(aliases).toEqual([
        { email: 'testuser@localhost', primary: true },
      ]);
    });

    it('should return default labels', async () => {
      const labels = await manager.getUserLabels();
      expect(labels).toHaveLength(4);
      expect(labels[0]).toEqual({
        id: 'INBOX',
        name: 'INBOX',
        color: { backgroundColor: '#000000', textColor: '#ffffff' },
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for token-based authentication', async () => {
      await expect(manager.getTokens('test-code')).rejects.toThrow(
        'Token-based authentication not supported for Dovecot'
      );
    });

    it('should handle draft operations gracefully', async () => {
      await expect(manager.getDraft('test-id')).rejects.toThrow(
        'Draft management not implemented for Dovecot'
      );
    });
  });

  // Note: The following tests require a running Dovecot instance
  // They are commented out to avoid test failures in CI/CD
  
  /*
  describe('IMAP operations (requires running Dovecot)', () => {
    it('should list messages from INBOX', async () => {
      const result = await manager.list({
        folder: 'inbox',
        maxResults: 10,
      });
      
      expect(result).toHaveProperty('threads');
      expect(result).toHaveProperty('nextPageToken');
      expect(Array.isArray(result.threads)).toBe(true);
    });

    it('should get a specific message', async () => {
      // First get a list to find a message ID
      const list = await manager.list({ folder: 'inbox', maxResults: 1 });
      
      if (list.threads.length > 0) {
        const messageId = list.threads[0].id;
        const result = await manager.get(messageId);
        
        expect(result).toHaveProperty('messages');
        expect(result).toHaveProperty('latest');
        expect(result).toHaveProperty('hasUnread');
        expect(result).toHaveProperty('totalReplies');
        expect(result).toHaveProperty('labels');
      }
    });
  });

  describe('SMTP operations (requires running SMTP server)', () => {
    it('should send an email', async () => {
      const emailData = {
        to: [{ email: 'alice@localhost', name: 'Alice' }],
        subject: 'Test Email from Dovecot Integration',
        message: '<p>This is a test email sent via the Dovecot integration.</p>',
        attachments: [],
        headers: {},
      };

      const result = await manager.create(emailData);
      expect(result).toHaveProperty('id');
      expect(result.id).toBeTruthy();
    });
  });
  */
});

// Helper function to check if Dovecot is running (for integration tests)
export async function isDovecotRunning(): Promise<boolean> {
  try {
    const manager = new DovecotMailManager(testConfig);
    // Try to connect - if it fails, Dovecot is not running
    await manager.list({ folder: 'inbox', maxResults: 1 });
    return true;
  } catch (error) {
    return false;
  }
}
