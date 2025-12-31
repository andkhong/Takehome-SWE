import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import { db } from '../db.js';
import { createAIStream, type Message } from '../openai-stream.js';

const router = Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'chats-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

/**
 * GET /api/chats
 * List all conversations, ordered by most recent first
 */
router.get('/', (req, res) => {
  logger.info('Listing all conversations');
  const stmt = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC');
  const rows = stmt.all();
  res.json(rows);
});

/**
 * POST /api/chats
 * Create a new conversation
 * Body: { title?: string }
 */
router.post('/', (req, res) => {
  logger.info('Creating new conversation');
  const id = uuidv4();
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)');
  stmt.run(id, req.body.title || 'New Conversation', now, now);
  res.json({ id });
});

/**
 * GET /api/chats/:id
 * Get a single conversation by ID
 */
router.get('/:id', (req, res) => {
  logger.info('Getting conversation by ID');
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  const row = stmt.get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(row);
});

/**
 * PATCH /api/chats/:id
 * Update conversation (e.g., title)
 * Body: { title: string }
 */
router.patch('/:id', (req, res) => {
  logger.info('Updating conversation by ID');
  const stmt = db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?');
  const row = stmt.run(req.body.title, new Date().toISOString(), req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ id: row.lastInsertRowid });
});

/**
 * DELETE /api/chats/:id
 * Delete a conversation and all its messages
 */
router.delete('/:id', (req, res) => {
  logger.info('Deleting conversation by ID');
  const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
  const row = stmt.run(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ id: row.lastInsertRowid });
});

/**
 * GET /api/chats/:id/messages
 * Get all messages for a conversation
 */
router.get('/:id/messages', (req, res) => {
  logger.info('Getting messages for conversation by ID');
  const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(req.params.id);
  res.json(rows);
});

/**
 * POST /api/chats/:id/messages
 * Send a user message and stream back AI response via SSE
 * Body: { content: string }
 *
 * This endpoint should:
 * 1. Save the user message to the database
 * 2. Create a placeholder assistant message (status: 'sending')
 * 3. Stream the AI response using SSE
 * 4. Update the assistant message when complete (or on error)
 *
 * SSE Format:
 *   event: chunk
 *   data: {"content": "word "}
 *
 *   event: done
 *   data: {"messageId": "xxx", "content": "full response"}
 *
 *   event: error
 *   data: {"error": "error message"}
 */
router.post('/:id/messages', (req, res) => {
  const conversationId = req.params.id;
  const { content } = req.body;

  // 1. Input validation
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return res.status(400).json({ error: 'Message content cannot be empty' });
  }
  if (trimmedContent.length > 10000) {
    return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
  }

  logger.info('Posting new message to conversation', { conversationId });

  try {
    // 2. Verify conversation exists
    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 3. Database operations in transaction for atomicity
    const result = db.transaction(() => {
      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      const now = new Date().toISOString();

      // Insert user message
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userMessageId, conversationId, 'user', trimmedContent, 'sent', now);

      // Insert assistant placeholder
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(assistantMessageId, conversationId, 'assistant', '', 'sending', now);

      // Update conversation timestamp
      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
        .run(now, conversationId);

      // Fetch conversation history for context
      const historyRows = db.prepare(
        'SELECT role, content FROM messages WHERE conversation_id = ? AND id != ? ORDER BY created_at ASC'
      ).all(conversationId, assistantMessageId) as Array<{
        role: string;
        content: string;
      }>;

      const conversationHistory = historyRows.map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
      }));

      return { assistantMessageId, conversationHistory };
    })();

    // 4. Set SSE headers AFTER successful database operations
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 5. Stream AI response
    // Note: cleanup function is returned but not used for disconnect handling
    // as Node.js req.on('close') is unreliable with SSE. OpenAI SDK handles cleanup internally.
    createAIStream(
      trimmedContent,
      // onChunk: Send SSE chunk events
      (chunk) => {
        res.write(`event: chunk\n`);
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      },
      // onError: Update message status to 'failed', send error event
      (error) => {
        logger.error('AI stream error', { error: error.message, conversationId });

        db.prepare('UPDATE messages SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', error.message, result.assistantMessageId);

        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      },
      // onDone: Update message content and status to 'sent', send done event
      (fullText) => {
        logger.info('AI stream complete', { conversationId, messageId: result.assistantMessageId });

        db.prepare('UPDATE messages SET content = ?, status = ? WHERE id = ?')
          .run(fullText, 'sent', result.assistantMessageId);

        res.write(`event: done\n`);
        res.write(
          `data: ${JSON.stringify({ messageId: result.assistantMessageId, content: fullText })}\n\n`
        );
        res.end();
      },
      // Options: Pass conversation history for context
      { conversationHistory: result.conversationHistory }
    );

  } catch (error) {
    logger.error('Error processing message', { error, conversationId });

    // If headers not sent yet, return JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process message' });
    }

    // If streaming already started, send SSE error
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

export default router;
