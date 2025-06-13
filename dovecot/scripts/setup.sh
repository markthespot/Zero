#!/bin/bash

# Dovecot Local Development Setup Script
echo "🚀 Setting up Dovecot local development environment..."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p ../mail ../ssl/private

# Set proper permissions
echo "🔒 Setting permissions..."
chmod 600 ../config/users
chmod 755 ../mail
chmod 700 ../ssl/private

echo "✅ Dovecot setup directories created!"
echo ""
echo "📋 Next steps:"
echo "1. cd dovecot"
echo "2. docker-compose up -d"
echo "3. Test with: telnet localhost 143"
echo ""
echo "👥 Test Users:"
echo "  testuser@localhost:testpass"
echo "  alice@localhost:alicepass"
echo "  bob@localhost:bobpass"
