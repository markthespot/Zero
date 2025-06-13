# Dovecot IMAP/POP3 Integration

This document describes the Dovecot IMAP/POP3 server integration for Zero Email, enabling connection to both local and remote Dovecot servers.

## Overview

The Dovecot integration allows Zero Email to connect to any Dovecot IMAP/POP3 server, providing:

- **IMAP Support**: Full IMAP protocol support for reading emails
- **POP3 Support**: POP3 protocol support for simple email retrieval
- **SMTP Support**: Email sending via SMTP
- **Local Development**: Complete local Dovecot setup for testing
- **Production Ready**: Support for remote Dovecot servers

## Quick Start

### 1. Local Development Setup

Start the local Dovecot server:

```bash
# Setup and start Dovecot
pnpm dovecot:setup
pnpm dovecot:up

# Check status
pnpm dovecot:status

# Test the integration
pnpm dovecot:test
```

### 2. Test Accounts

The local setup includes these test accounts:

| Username | Password | Email |
|----------|----------|-------|
| testuser@localhost | testpass | testuser@localhost |
| alice@localhost | alicepass | alice@localhost |
| bob@localhost | bobpass | bob@localhost |
| demo@localhost | demopass | demo@localhost |

### 3. Connection Settings

**Local Development:**
- IMAP: localhost:143 (non-SSL) or localhost:993 (SSL)
- POP3: localhost:110 (non-SSL) or localhost:995 (SSL)
- SMTP: localhost:587

**Production:**
- Configure via environment variables or database settings

## Architecture

### Driver Implementation

The `DovecotMailManager` class implements the `MailManager` interface:

```typescript
// apps/server/src/lib/driver/dovecot.ts
export class DovecotMailManager implements MailManager {
  // IMAP/POP3 connection management
  // Email parsing and processing
  // SMTP sending capabilities
}
```

### Database Schema

Extended the connection schema to support Dovecot:

```sql
-- Connection table supports 'dovecot' provider
providerId: 'google' | 'microsoft' | 'dovecot'

-- New dovecot_connection table for Dovecot-specific settings
CREATE TABLE dovecot_connection (
  id TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES connection(id),
  host TEXT NOT NULL,
  port INTEGER DEFAULT 143,
  secure BOOLEAN DEFAULT FALSE,
  protocol TEXT DEFAULT 'imap', -- 'imap' or 'pop3'
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT FALSE
);
```

### Configuration Management

Dovecot settings can be configured via:

1. **Environment Variables** (for development):
   ```env
   DOVECOT_HOST=localhost
   DOVECOT_PORT=143
   DOVECOT_SECURE=false
   DOVECOT_PROTOCOL=imap
   DOVECOT_SMTP_HOST=localhost
   DOVECOT_SMTP_PORT=587
   ```

2. **Database Settings** (for production):
   - Stored in `dovecot_connection` table
   - Linked to user connections

3. **Runtime Configuration**:
   ```typescript
   const config: DovecotConfig = {
     auth: {
       userId: 'user-id',
       email: 'user@example.com',
       accessToken: 'password', // Used as password for Dovecot
       host: 'mail.example.com',
       port: 993,
       secure: true,
       protocol: 'imap',
     }
   };
   ```

## Features

### Implemented Features

✅ **IMAP Connection**: Connect to Dovecot IMAP servers  
✅ **Email Listing**: List emails from folders (INBOX, Sent, etc.)  
✅ **Email Retrieval**: Get full email content with attachments  
✅ **Email Parsing**: Parse MIME messages with HTML/text content  
✅ **SMTP Sending**: Send emails via SMTP  
✅ **Folder Management**: Basic folder/label support  
✅ **Local Development**: Complete Docker-based local setup  
✅ **Error Handling**: Comprehensive error handling and logging  

### Partially Implemented

🔄 **POP3 Support**: Basic structure in place, needs completion  
🔄 **Draft Management**: Basic implementation, needs IMAP APPEND  
🔄 **Flag Management**: Read/unread status, needs IMAP STORE  
🔄 **Search**: Basic text search, can be enhanced  

### Not Yet Implemented

❌ **Advanced Search**: Complex search queries  
❌ **Message Threading**: Email conversation threading  
❌ **Folder Creation**: Creating new IMAP folders  
❌ **Message Moving**: Moving messages between folders  
❌ **Attachment Handling**: Advanced attachment processing  

## Usage Examples

### Basic Email Listing

```typescript
import { DovecotMailManager } from './lib/driver/dovecot';

const manager = new DovecotMailManager(config);

// List emails from INBOX
const result = await manager.list({
  folder: 'inbox',
  maxResults: 20,
  query: 'from:example@domain.com'
});

console.log(`Found ${result.threads.length} emails`);
```

### Sending Email

```typescript
const emailData = {
  to: [{ email: 'recipient@example.com', name: 'Recipient' }],
  subject: 'Test Email',
  message: '<p>Hello from Zero Email!</p>',
  attachments: [],
  headers: {},
};

const result = await manager.create(emailData);
console.log(`Email sent with ID: ${result.id}`);
```

### Reading Email

```typescript
// Get specific email
const email = await manager.get('message-id');

console.log(`Subject: ${email.latest?.subject}`);
console.log(`From: ${email.latest?.sender.email}`);
console.log(`Body: ${email.latest?.body}`);
```

## Local Development

### Directory Structure

```
dovecot/
├── docker-compose.yml     # Docker setup
├── config/
│   ├── dovecot.conf      # Dovecot configuration
│   └── users             # Test user accounts
├── scripts/
│   └── setup.sh          # Setup script
├── mail/                 # Mail storage (auto-created)
├── ssl/                  # SSL certificates (auto-created)
└── README.md            # Detailed setup instructions
```

### Management Commands

```bash
# Start Dovecot
pnpm dovecot:up

# Stop Dovecot
pnpm dovecot:down

# View logs
pnpm dovecot:logs

# Test connection
pnpm dovecot:test

# Check server status
pnpm dovecot:status
```

### Manual Testing

Test IMAP connection manually:

```bash
# Connect to IMAP
telnet localhost 143

# Login
a1 LOGIN testuser@localhost testpass

# List folders
a2 LIST "" "*"

# Select INBOX
a3 SELECT INBOX

# Fetch messages
a4 FETCH 1:* (FLAGS ENVELOPE)

# Logout
a5 LOGOUT
```

## Production Deployment

### Remote Dovecot Server

For production, configure connection to remote Dovecot:

```typescript
const productionConfig: DovecotConfig = {
  auth: {
    userId: 'user-id',
    email: 'user@yourdomain.com',
    accessToken: 'user-password',
    host: 'mail.yourdomain.com',
    port: 993,
    secure: true,
    protocol: 'imap',
    smtpHost: 'mail.yourdomain.com',
    smtpPort: 587,
    smtpSecure: true,
  }
};
```

### Security Considerations

1. **SSL/TLS**: Always use secure connections in production
2. **Authentication**: Use strong passwords or certificate-based auth
3. **Firewall**: Restrict access to mail server ports
4. **Monitoring**: Monitor connection attempts and failures

### Web Hosting Integration

Most web hosting providers offer Dovecot-compatible email services:

- **cPanel/WHM**: Usually includes Dovecot
- **Plesk**: Supports Dovecot configuration
- **DirectAdmin**: Compatible with Dovecot
- **Custom VPS**: Install Dovecot manually

## Testing

### Unit Tests

```bash
# Run Dovecot-specific tests
cd apps/server
npm test -- dovecot.test.ts
```

### Integration Tests

```bash
# Test with running Dovecot instance
pnpm dovecot:up
pnpm dovecot:test
```

### Manual Testing Checklist

- [ ] IMAP connection successful
- [ ] Email listing works
- [ ] Email retrieval works
- [ ] Email sending works
- [ ] Error handling works
- [ ] SSL/TLS connections work
- [ ] Multiple user accounts work

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if Dovecot is running: `pnpm dovecot:status`
   - Verify port configuration
   - Check firewall settings

2. **Authentication Failed**
   - Verify username/password in `dovecot/config/users`
   - Check Dovecot logs: `pnpm dovecot:logs`

3. **SSL/TLS Errors**
   - For development, disable SSL verification
   - For production, ensure valid certificates

4. **Email Not Sending**
   - Check SMTP configuration
   - Verify SMTP server is running
   - Check authentication credentials

### Debug Mode

Enable debug logging:

```typescript
// Add to Dovecot configuration
const config = {
  // ... other config
  debug: true,
  logger: console,
};
```

## Contributing

To contribute to the Dovecot integration:

1. **Setup Development Environment**:
   ```bash
   pnpm install
   pnpm dovecot:up
   ```

2. **Run Tests**:
   ```bash
   pnpm dovecot:test
   ```

3. **Make Changes**: Edit files in `apps/server/src/lib/driver/`

4. **Test Changes**: Ensure all tests pass

5. **Submit PR**: Follow the project's contribution guidelines

## Roadmap

### Short Term
- [ ] Complete POP3 implementation
- [ ] Improve draft management
- [ ] Add message flag support
- [ ] Enhanced error handling

### Medium Term
- [ ] Advanced search capabilities
- [ ] Message threading
- [ ] Folder management
- [ ] Performance optimizations

### Long Term
- [ ] OAuth integration for Dovecot
- [ ] Advanced attachment handling
- [ ] Real-time notifications
- [ ] Clustering support

## Support

For issues and questions:

1. Check this documentation
2. Review the `dovecot/README.md` file
3. Check existing GitHub issues
4. Create a new issue with detailed information

---

*This integration enables Zero Email to work with any Dovecot-compatible email server, providing flexibility for both development and production deployments.*
