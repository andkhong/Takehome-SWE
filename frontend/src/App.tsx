import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api/client';
import type { Conversation, Message } from './types';
import { MessageInput } from './components/MessageInput';

function App() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiFetch<Conversation[]>('/chats'),
  });

  const { data: messages, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', selectedConversationId],
    queryFn: () => apiFetch<Message[]>(`/chats/${selectedConversationId}/messages`),
    enabled: !!selectedConversationId,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const createNewChat = async () => {
    setIsCreatingChat(true);
    try {
      const newChat = await apiFetch<{ id: string }>('/chats', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      // Invalidate and refetch conversations list
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Select the newly created chat
      setSelectedConversationId(newChat.id);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const getMessagesByConversationId = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#f5f5f5',
      }}
    >
      <aside
        style={{
          width: 280,
          background: '#fff',
          borderRight: '1px solid #e0e0e0',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 style={{ marginBottom: 16, fontSize: 18 }}>Conversations</h2>

        <button
          style={{
            marginBottom: 16,
            padding: '8px 16px',
            background: isCreatingChat ? '#e0e0e0' : '#2196f3',
            color: isCreatingChat ? '#999' : '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: isCreatingChat ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
          onClick={createNewChat}
          disabled={isCreatingChat}
        >
          {isCreatingChat ? 'Creating...' : '+ New Chat'}
        </button>

        {isLoading ? (
          <p style={{ color: '#666', fontSize: 14 }}>Loading...</p>
        ) : error ? (
          <p style={{ color: '#d32f2f', fontSize: 14 }}>Error loading conversations</p>
        ) : conversations && conversations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conversations.map((conversation: Conversation) => (
              <div
                key={conversation.id}
                onClick={() => getMessagesByConversationId(conversation.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedConversationId === conversation.id ? '#e3f2fd' : '#f5f5f5',
                  border: selectedConversationId === conversation.id ? '1px solid #2196f3' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedConversationId !== conversation.id) {
                    e.currentTarget.style.background = '#eeeeee';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversationId !== conversation.id) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                  {conversation.title || 'Untitled Conversation'}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#666' }}>
                  {new Date(conversation.updated_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontSize: 14 }}>No conversations</p>
        )}
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversationId ? (
          <>
            <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
              <h3 style={{ marginTop: 0 }}>Messages</h3>
              {isLoadingMessages ? (
                <p style={{ color: '#666' }}>Loading messages...</p>
              ) : messagesError ? (
                <p style={{ color: '#d32f2f' }}>Error loading messages</p>
              ) : messages && messages.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.map((message: Message) => (
                    <div
                      key={message.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, color: '#666', marginBottom: 4 }}>
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                      <p style={{ margin: 0, fontSize: 14 }}>{message.content}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#999' }}>
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {streamingMessage && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: '#f5f5f5',
                        alignSelf: 'flex-start',
                        maxWidth: '70%',
                        opacity: 0.95,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, color: '#666', marginBottom: 4 }}>
                        Assistant <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>●</span>
                      </p>
                      <p style={{ margin: 0, fontSize: 14 }}>{streamingMessage}</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <p style={{ color: '#666' }}>No messages in this conversation</p>
              )}
            </div>
            <MessageInput
              conversationId={selectedConversationId}
              onChunk={(chunk) => setStreamingMessage((prev) => prev + chunk)}
              onMessageSent={() => {
                setStreamingMessage('');
                refetchMessages();
              }}
            />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
            }}
          >
            Select a conversation or start a new one
          </div>
        )}
      </main>
    </div>
  );
}

export default App;