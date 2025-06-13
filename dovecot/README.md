# Dovecot Local Development Setup

This directory contains the configuration for running a local Dovecot IMAP/POP3 server for development and testing purposes.

## Quick Start

1. **Start the Dovecot server:**
   ```bash
   cd dovecot
   docker-compose up -d
   ```

2. **Stop the Dovecot server:**
   ```bash
   cd dovecot
   docker-compose down
   ```

3. **View logs:**
   ```bash
   cd dovecot
   docker-compose logs -f dovecot
   ```

## Test Accounts

The following test accounts are pre-configured:

| Username | Password | Email |
|----------|----------|-------|
| testuser@localhost | testpass | testuser@localhost |
| alice@localhost | alicepass | alice@localhost |
| bob@localhost | bobpass | bob@localhost |
| demo@localhost | demopass | demo@localhost |
| user1@localhost | password1 | user1@localhost |
| user2@localhost | password2 | user2@localhost |

## Connection Settings

### IMAP Settings
- **Server:** localhost
- **Port:** 143 (non-SSL) or 993 (SSL)
- **Security:** None (for development) or SSL/TLS
- **Authentication:** Plain/Login

### POP3 Settings
- **Server:** localhost
- **Port:** 110 (non-SSL) or 995 (SSL)
- **Security:** None (for development) or SSL/TLS
- **Authentication:** Plain/Login

### SMTP Settings (if using Postfix)
- **Server:** localhost
- **Port:** 25 or 587
- **Security:** None (for development)
- **Authentication:** Plain

## Testing with Mail Clients

You can test the setup with various mail clients:

### Using telnet (IMAP)
```bash
telnet localhost 143
a1 LOGIN testuser@localhost testpass
a2 LIST "" "*"
a3 SELECT INBOX
a4 FETCH 1:* (FLAGS ENVELOPE)
a5 LOGOUT
```

### Using telnet (POP3)
```bash
telnet localhost 110
USER testuser@localhost
PASS testpass
LIST
RETR 1
QUIT
```

### Using curl (IMAP)
```bash
# List folders
curl --url 'imap://localhost:143' --user 'testuser@localhost:testpass'

# List messages in INBOX
curl --url 'imap://localhost:143/INBOX' --user 'testuser@localhost:testpass'
```

## Directory Structure

```
dovecot/
├── docker-compose.yml     # Docker Compose configuration
├── config/
│   ├── dovecot.conf      # Main Dovecot configuration
│   └── users             # User accounts file
├── mail/                 # Mail storage (created automatically)
├── ssl/                  # SSL certificates (created automatically)
└── README.md            # This file
```

## Configuration Files

- **dovecot.conf**: Main Dovecot configuration with IMAP/POP3 settings
- **users**: Simple file-based user database for development
- **docker-compose.yml**: Docker setup with Dovecot and optional Postfix

## SSL Certificates

For development, Dovecot will generate self-signed certificates automatically. For production use, you should replace these with proper SSL certificates.

## Adding New Users

To add new test users, edit the `config/users` file and restart the container:

```bash
echo "newuser@localhost:newpass:1000:1000:New User:/var/mail/newuser@localhost:/bin/false" >> config/users
docker-compose restart dovecot
```

## Troubleshooting

1. **Check if ports are available:**
   ```bash
   netstat -tlnp | grep -E ':(143|993|110|995)'
   ```

2. **View Dovecot logs:**
   ```bash
   docker-compose logs dovecot
   ```

3. **Access container shell:**
   ```bash
   docker-compose exec dovecot /bin/bash
   ```

4. **Check Dovecot configuration:**
   ```bash
   docker-compose exec dovecot doveconf -n
   ```

## Production Considerations

This setup is for development only. For production:

1. Use proper SSL certificates
2. Enable authentication encryption
3. Configure proper user management (LDAP, SQL, etc.)
4. Set up proper mail storage and backup
5. Configure firewall and security settings
6. Use proper logging and monitoring
