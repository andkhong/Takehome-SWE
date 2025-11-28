# Muro Take-Home Challenge: Streaming Chat

## Overview

Build a chat interface that streams AI responses in real-time with robust error handling.

At Muro, we help construction teams analyze complex documents using AI. A smooth, reliable chat experience is critical to user trust. This challenge tests your ability to build real-time interfaces that handle the messy realities of network requests and AI services.

**This challenge uses the real OpenAI API** - you'll be working with actual AI responses, not mocked data. An API key will be provided to you.

## Time Expectation

- **Target**: 3-4 hours
- **Hard limit**: Please don't spend more than 4 hours
- **It's OK** to not finish everything - we value quality over quantity

# Getting Started

## 1. Setup OpenAI API Key

An OpenAI API key will be provided to you separately. Once you receive it:

1. Copy `backend/.env.example` to `backend/.env`
2. Add the provided API key to `backend/.env`:
   ```
   OPENAI_API_KEY=sk-your-provided-key-here
   ```

## 2. Start the Backend

```bash
# Install backend dependencies
cd backend
npm install

# Seed the database with sample data
npm run seed

# Start the backend (runs on http://localhost:3001)
npm run dev
```

## 3. Start the Frontend

In a new terminal:

```bash
# Install frontend dependencies
cd frontend
npm install

# Start the frontend (runs on http://localhost:5173)
npm run dev
```

Visit http://localhost:5173 to see the starter app.

## Requirements

### Must Have (Core)

These are required for a complete submission:

- [ ] **Conversation List**: Display all conversations in the sidebar
- [ ] **Create Conversation**: Button to start a new conversation
- [ ] **View Messages**: Show message history when selecting a conversation
- [ ] **Send Message**: Input to send a user message
- [ ] **Streaming Response**: AI response appears word-by-word as it streams
- [ ] **Error Handling**: Show error message when AI request fails (network issues, API errors)

### Extensions (If Time Permits)

If you complete the core requirements ahead of schedule and have time remaining, feel free to add any extensions or improvements you think would enhance the experience. This is entirely optional and at your discretion.

## Technical Details

### Backend

The backend starter includes:

- **Express app** with CORS configured for the frontend
- **SQLite database** with schema for conversations and messages
- **OpenAI integration** (`openai-stream.ts`) that calls the real OpenAI API and streams responses
- **Route stubs** in `src/routes/chats.ts` - you implement these

The OpenAI API key is pre-configured in `.env`. The `createAIStream()` helper handles the API call and provides callbacks for streaming chunks, errors, and completion.

API Endpoints to implement:

| Method | Endpoint                    | Description                            |
| ------ | --------------------------- | -------------------------------------- |
| GET    | `/api/chats`              | List all conversations                 |
| POST   | `/api/chats`              | Create new conversation                |
| GET    | `/api/chats/:id`          | Get single conversation                |
| PATCH  | `/api/chats/:id`          | Update conversation (title)            |
| DELETE | `/api/chats/:id`          | Delete conversation                    |
| GET    | `/api/chats/:id/messages` | Get messages for conversation          |
| POST   | `/api/chats/:id/messages` | Send message, stream AI response (SSE) |

### SSE Response Format

The `/api/chats/:id/messages` endpoint should use Server-Sent Events:

```
event: chunk
data: {"content": "word "}

event: chunk
data: {"content": "another "}

event: done
data: {"messageId": "xxx", "content": "full response text"}
```

On error:

```
event: error
data: {"error": "AI service temporarily unavailable"}
```

### Frontend

The frontend starter includes:

- **React + TypeScript** with Vite
- **React Router** for navigation
- **API client** with SSE helper in `src/api/client.ts`
- **TypeScript types** in `src/types.ts`

You decide how to structure components and manage state.

### Database Schema

```sql
conversations (id, title, created_at, updated_at)
messages (id, conversation_id, role, content, status, error_message, created_at)
```

- `role` is either 'user' or 'assistant'
- `status` is 'sending', 'sent', or 'failed'

## Evaluation Criteria

**What we're looking for:**

1. **Does it work?** Can we have a conversation with streaming responses?
2. **Error handling**: Does retry work? Is the error UX clear?
3. **Code quality**: Is it readable and reasonably organized?
4. **UX decisions**: Does it feel good to use?

**What we're NOT looking for:**

- Pixel-perfect design (basic styling is fine)
- 100% test coverage
- Production-ready error handling for every edge case
- Use of any specific libraries (choose what you prefer)

## Submission

1. **Fork this repository** to your own GitHub account
2. Clone your fork and complete the challenge:

   ```bash
   git clone https://github.com/YOUR_USERNAME/takehome-streaming-chat.git
   cd takehome-streaming-chat
   ```
3. Push your completed work to your forked repository
4. Invite `Gregory-PublishAI` as a collaborator to your forked repository
5. Fill in the `NOTES.md` file with your implementation notes
6. Email us with the link to your forked repository when ready

## Questions?

If you have questions about the requirements or run into setup issues, please email us - we're happy to clarify.

Good luck!
