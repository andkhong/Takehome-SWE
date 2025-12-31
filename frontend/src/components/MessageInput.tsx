import { useState, useRef, useEffect } from 'react';
import { subscribeToSSE } from '../api/client';

interface MessageInputProps {
    conversationId: string;
    onChunk?: (chunk: string) => void;
    onMessageSent?: () => void;
}

export function MessageInput({ conversationId, onChunk, onMessageSent }: MessageInputProps) {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFailedMessage, setLastFailedMessage] = useState<string>('');
    const cleanupRef = useRef<(() => void) | null>(null);

    // Cleanup SSE stream on component unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            cleanupRef.current?.();
        };
    }, []);

    const submitMessage = async (messageToSend: string) => {
        if (!messageToSend.trim()) return;

        // Cancel any ongoing stream before starting a new one to prevent race conditions
        cleanupRef.current?.();

        setIsSubmitting(true);
        setError(null);

        // Use SSE streaming for real-time responses
        cleanupRef.current = subscribeToSSE(
            `/chats/${conversationId}/messages`,
            {
                method: 'POST',
                body: JSON.stringify({ content: messageToSend.trim() }),
            },
            {
                onChunk: (data: any) => {
                    // Pass chunks to parent for real-time display
                    console.log('Streaming chunk:', data.content);
                    onChunk?.(data.content);
                },
                onDone: (data: any) => {
                    console.log('Stream complete:', data);
                    setMessage('');
                    setLastFailedMessage('');
                    setIsSubmitting(false);
                    onMessageSent?.();
                },
                onError: (error: Error) => {
                    console.error('Stream error:', error);
                    setError(error.message);
                    setLastFailedMessage(messageToSend);
                    setIsSubmitting(false);
                },
            }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitMessage(message);
    };

    const handleRetry = async () => {
        await submitMessage(lastFailedMessage);
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 16,
                borderTop: '1px solid #e0e0e0',
                background: '#fff',
            }}
        >
            {error && (
                <div
                    style={{
                        padding: '12px',
                        background: '#ffebee',
                        color: '#c62828',
                        borderRadius: 4,
                        fontSize: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>{error}</span>
                    <button
                        onClick={handleRetry}
                        disabled={isSubmitting}
                        style={{
                            padding: '6px 12px',
                            background: '#c62828',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            marginLeft: 12,
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isSubmitting}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#2196f3';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                    }}
                />
                <button
                    type="submit"
                    disabled={isSubmitting || !message.trim()}
                    style={{
                        padding: '12px 24px',
                        background: isSubmitting || !message.trim() ? '#e0e0e0' : '#2196f3',
                        color: isSubmitting || !message.trim() ? '#999' : '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: isSubmitting || !message.trim() ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (!isSubmitting && message.trim()) {
                            e.currentTarget.style.background = '#1976d2';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isSubmitting && message.trim()) {
                            e.currentTarget.style.background = '#2196f3';
                        }
                    }}
                >
                    {isSubmitting ? 'Sending...' : 'Send'}
                </button>
            </div>
        </form>
    );
}
