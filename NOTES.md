# Requirements

Node v24.10.0+

Had to upgrade because the current version of node was not compatible with the backend dependencies (better-sqlite3)

# Implementation Notes

## What I Built

Implemented a chat application with real-time messaging using SSE and React Query. The application allows users to create and manage conversations, send messages, and view real-time responses from an AI assistant. The API uses OpenAI's API to generate responses.

## Technical Decisions

[Any interesting choices you made and why - state management approach, component structure, libraries used, etc.]

Used react-query for state management and caching.

## What I'd Do Differently

If I had more time, I would implemented caching for the messagesa and conversations. Quering the database for every message is not efficient.

In addition, we can further optimize the context window of the LLM with prefix caching. Using vLLM or other LLM inference servers can also help with the performance.

## Time Spent

Around 4-5 hours. Majority of the time was spent debugging and verifying the functionality.

## Questions or Feedback

Challenge with AI assistance makes it very possilble to complete within the recommended time limit of 4 hours.
