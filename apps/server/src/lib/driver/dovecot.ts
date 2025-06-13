import type { IOutgoingMessage, Label, ParsedMessage, DeleteAllSpamResponse } from '../../types';
import type { MailManager, ManagerConfig, IGetThreadResponse, ParsedDraft } from './types';
import type { CreateDraftData } from '../schemas';
import { parseAddressList, parseFrom, wasSentWithTLS } from '../email-utils';
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import { StandardizedError, sanitizeContext } from './utils';
import { simpleParser } from 'mailparser';
import * as nodemailer from 'nodemailer';
import * as Imap from 'imap';
import * as he from 'he';

// Dovecot-specific configuration interface
export interface DovecotConfig extends ManagerConfig {
  auth: ManagerConfig['auth'] & {
    host: string;
    port: number;
    secure: boolean;
    protocol: 'imap' | 'pop3';
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
  };
}

export class DovecotMailManager implements MailManager {
  private imap: Imap | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(public config: DovecotConfig) {
    this.initializeConnections();
  }

  private initializeConnections() {
    // Initialize IMAP connection
    if (this.config.auth.protocol === 'imap') {
      this.imap = new Imap({
        user: this.config.auth.email,
        password: this.config.auth.accessToken, // Using accessToken as password for Dovecot
        host: this.config.auth.host,
        port: this.config.auth.port,
        tls: this.config.auth.secure,
        tlsOptions: {
          rejectUnauthorized: false, // For development with self-signed certs
        },
      });
    }

    // Initialize SMTP connection for sending emails
    if (this.config.auth.smtpHost) {
      this.smtpTransporter = nodemailer.createTransporter({
        host: this.config.auth.smtpHost,
        port: this.config.auth.smtpPort || 587,
        secure: this.config.auth.smtpSecure || false,
        auth: {
          user: this.config.auth.email,
          pass: this.config.auth.accessToken,
        },
        tls: {
          rejectUnauthorized: false, // For development
        },
      });
    }
  }

  public getScope(): string {
    return 'imap pop3 smtp';
  }

  public async getTokens(code: string): Promise<{
    tokens: { access_token?: string; refresh_token?: string; expiry_date?: number };
  }> {
    // For Dovecot, we don't use OAuth tokens, but rather direct credentials
    // This method is required by the interface but not applicable for Dovecot
    throw new Error('Token-based authentication not supported for Dovecot');
  }

  public async getUserInfo(tokens?: ManagerConfig['auth']): Promise<{
    address: string;
    name: string;
    photo: string;
  }> {
    return {
      address: this.config.auth.email,
      name: this.config.auth.email.split('@')[0] || 'User',
      photo: '',
    };
  }

  public async revokeToken(token: string): Promise<boolean> {
    // Not applicable for Dovecot
    return true;
  }

  private async withErrorHandler<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      console.error(`[Dovecot Driver Error] Operation: ${operation}`, {
        error: error.message,
        code: error.code,
        context: sanitizeContext(context),
        stack: error.stack,
      });
      throw new StandardizedError(error, operation, context);
    }
  }

  private connectImap(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not initialized'));
        return;
      }

      if (this.imap.state === 'authenticated') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('IMAP connection timeout'));
      }, 10000); // 10 second timeout

      this.imap.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.imap.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      try {
        this.imap.connect();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  private disconnectImap(): void {
    if (this.imap && this.imap.state === 'authenticated') {
      this.imap.end();
    }
  }

  public async list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }): Promise<{
    threads: { id: string; historyId: string | null; $raw?: unknown }[];
    nextPageToken: string | null;
  }> {
    return this.withErrorHandler(
      'list',
      async () => {
        await this.connectImap();
        
        const folderName = this.normalizeFolderName(params.folder);
        const maxResults = params.maxResults || 50;
        
        return new Promise((resolve, reject) => {
          if (!this.imap) {
            reject(new Error('IMAP not initialized'));
            return;
          }

          this.imap.openBox(folderName, true, (err, box) => {
            if (err) {
              reject(err);
              return;
            }

            // Search for messages
            const searchCriteria = params.query ? ['TEXT', params.query] : ['ALL'];
            
            this.imap!.search(searchCriteria, (err, results) => {
              if (err) {
                reject(err);
                return;
              }

              // Limit results
              const limitedResults = results.slice(0, maxResults);
              
              const threads = limitedResults.map((uid) => ({
                id: uid.toString(),
                historyId: null,
                $raw: { uid, box: folderName },
              }));

              resolve({
                threads,
                nextPageToken: results.length > maxResults ? 'next' : null,
              });
            });
          });
        });
      },
      params,
    );
  }

  public async get(id: string): Promise<IGetThreadResponse> {
    return this.withErrorHandler(
      'get',
      async () => {
        await this.connectImap();
        
        return new Promise((resolve, reject) => {
          if (!this.imap) {
            reject(new Error('IMAP not initialized'));
            return;
          }

          // Open INBOX by default
          this.imap.openBox('INBOX', true, (err, box) => {
            if (err) {
              reject(err);
              return;
            }

            const fetch = this.imap!.fetch(id, {
              bodies: '',
              struct: true,
              envelope: true,
            });

            const messages: ParsedMessage[] = [];
            
            fetch.on('message', (msg, seqno) => {
              let buffer = '';
              
              msg.on('body', (stream, info) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
              });

              msg.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const parsedMessage = this.parseEmailMessage(parsed, id);
                  messages.push(parsedMessage);
                } catch (parseError) {
                  console.error('Error parsing email:', parseError);
                }
              });
            });

            fetch.once('error', reject);
            
            fetch.once('end', () => {
              const latest = messages[messages.length - 1];
              const hasUnread = messages.some(msg => msg.unread);
              
              resolve({
                messages,
                latest,
                hasUnread,
                totalReplies: messages.length,
                labels: [{ id: 'INBOX', name: 'INBOX' }],
              });
            });
          });
        });
      },
      { id },
    );
  }

  private parseEmailMessage(parsed: any, id: string): ParsedMessage {
    const from = parseFrom(parsed.from?.text || '');
    const to = parseAddressList(parsed.to?.text || '');
    const cc = parsed.cc ? parseAddressList(parsed.cc.text) : [];
    const bcc = parsed.bcc ? parseAddressList(parsed.bcc.text) : [];

    return {
      id,
      threadId: id,
      subject: parsed.subject || '(No Subject)',
      snippet: parsed.text?.substring(0, 200) || '',
      sender: from,
      to,
      cc,
      bcc,
      receivedOn: parsed.date || new Date(),
      unread: true, // Default to unread, would need to check IMAP flags
      body: parsed.html || parsed.text || '',
      processedHtml: parsed.html || '',
      decodedBody: parsed.text || '',
      blobUrl: '',
      attachments: parsed.attachments?.map((att: any) => ({
        id: att.contentId || att.filename,
        filename: att.filename,
        mimeType: att.contentType,
        size: att.size,
        data: att.content,
      })) || [],
      tags: [{ id: 'INBOX', name: 'INBOX' }],
      headers: parsed.headers || {},
      wasSentWithTLS: false, // Would need to parse Received headers
    };
  }

  private normalizeFolderName(folder: string): string {
    const folderMap: Record<string, string> = {
      'inbox': 'INBOX',
      'sent': 'Sent',
      'drafts': 'Drafts',
      'trash': 'Trash',
      'spam': 'Junk',
      'junk': 'Junk',
    };
    
    return folderMap[folder.toLowerCase()] || folder;
  }

  // Implement remaining required methods with basic functionality
  public async create(data: IOutgoingMessage): Promise<{ id?: string | null }> {
    return this.withErrorHandler('create', async () => {
      if (!this.smtpTransporter) {
        throw new Error('SMTP not configured. Please set smtpHost in the Dovecot configuration.');
      }

      const mailOptions = {
        from: data.fromEmail || this.config.auth.email,
        to: data.to.map(t => t.email).join(', '),
        cc: data.cc?.map(c => c.email).join(', '),
        bcc: data.bcc?.map(b => b.email).join(', '),
        subject: data.subject,
        html: await sanitizeTipTapHtml(data.message),
        attachments: data.attachments?.map(att => ({
          filename: att.name,
          content: att.data,
          contentType: att.type,
        })),
      };

      const result = await this.smtpTransporter.sendMail(mailOptions);
      return { id: result.messageId };
    });
  }

  public async sendDraft(id: string, data: IOutgoingMessage): Promise<void> {
    // For Dovecot, we'll just send the email directly
    await this.create(data);
  }

  public async createDraft(data: CreateDraftData): Promise<{
    id?: string | null;
    success?: boolean;
    error?: string;
  }> {
    // Basic draft creation - in a real implementation, this would save to Drafts folder
    return { id: `draft_${Date.now()}`, success: true };
  }

  public async getDraft(id: string): Promise<ParsedDraft> {
    throw new Error('Draft management not implemented for Dovecot');
  }

  public async listDrafts(params: {
    q?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<{
    threads: { id: string; historyId: string | null; $raw: unknown }[];
    nextPageToken: string | null;
  }> {
    return this.list({ folder: 'drafts', ...params });
  }

  public async delete(id: string): Promise<void> {
    throw new Error('Delete not implemented for Dovecot');
  }

  public async count(): Promise<{ count?: number; label?: string }[]> {
    return [{ count: 0, label: 'INBOX' }];
  }

  public async markAsRead(threadIds: string[]): Promise<void> {
    // Would implement IMAP flag setting
  }

  public async markAsUnread(threadIds: string[]): Promise<void> {
    // Would implement IMAP flag setting
  }

  public normalizeIds(id: string[]): { threadIds: string[] } {
    return { threadIds: id };
  }

  public async modifyLabels(
    id: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ): Promise<void> {
    // Would implement IMAP folder/label management
  }

  public async getAttachment(messageId: string, attachmentId: string): Promise<string | undefined> {
    return undefined;
  }

  public async getUserLabels(): Promise<Label[]> {
    return [
      { id: 'INBOX', name: 'INBOX', color: { backgroundColor: '#000000', textColor: '#ffffff' } },
      { id: 'Sent', name: 'Sent', color: { backgroundColor: '#4285f4', textColor: '#ffffff' } },
      { id: 'Drafts', name: 'Drafts', color: { backgroundColor: '#ff9800', textColor: '#ffffff' } },
      { id: 'Trash', name: 'Trash', color: { backgroundColor: '#f44336', textColor: '#ffffff' } },
    ];
  }

  public async getLabel(id: string): Promise<Label> {
    const labels = await this.getUserLabels();
    const label = labels.find(l => l.id === id);
    if (!label) throw new Error(`Label ${id} not found`);
    return label;
  }

  public async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<void> {
    // Would implement IMAP folder creation
  }

  public async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ): Promise<void> {
    // Would implement IMAP folder renaming
  }

  public async deleteLabel(id: string): Promise<void> {
    // Would implement IMAP folder deletion
  }

  public async getEmailAliases(): Promise<{ email: string; name?: string; primary?: boolean }[]> {
    return [{ email: this.config.auth.email, primary: true }];
  }

  public async deleteAllSpam(): Promise<DeleteAllSpamResponse> {
    return { deletedCount: 0 };
  }
}
