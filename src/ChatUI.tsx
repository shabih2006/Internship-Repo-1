import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

export const ChatUI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up Web Speech instances on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Voice Input (Speech-to-Text) -> Populates Typing Bar cleanly
  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Try Chrome or Edge! 🎧');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('[Speech Recognition Error]:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  // Optional Manual Text-to-Speech Trigger
  const speakResponse = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Flush queue to prevent audio stacking
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: trimmedInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Point directly to backend Express server on port 3000
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: 1, prompt: trimmedInput }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      const data = await response.json();
      
      // Robust payload extraction across different backend endpoints
      const replyText = 
        data.reply || 
        data.text || 
        data.message || 
        (typeof data.data === 'string' ? data.data : null) ||
        "I couldn't process an answer for that query.";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: replyText,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[Chat Request Error]:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: 'Backend connection error. Please verify the Express server is running on port 3000! 💔',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '20px auto', fontFamily: 'sans-serif', color: '#111' }}>
      <h2 style={{ color: '#ffffff', textAlign: 'center', marginBottom: '20px' }}>
        ✨ Universal Voice & Document AI Assistant ✨
      </h2>
      
      {/* Chat Display Box */}
      <div
        style={{
          border: '1px solid #444',
          borderRadius: '12px',
          height: '450px',
          overflowY: 'auto',
          padding: '20px',
          marginBottom: '16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{ textAlign: msg.sender === 'user' ? 'right' : 'left', margin: '12px 0' }}
          >
            <div
              style={{
                display: 'inline-block',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: msg.sender === 'user' ? '#007bff' : '#f1f3f5',
                color: msg.sender === 'user' ? '#ffffff' : '#212529',
                fontSize: '15px',
                lineHeight: '1.4',
                maxWidth: '75%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                textAlign: 'left',
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
              
              {/* Manual Read Aloud Action */}
              {msg.sender === 'assistant' && (
                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e0e0e0' }}>
                  <button
                    onClick={() => speakResponse(msg.text)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#007bff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      padding: 0,
                    }}
                  >
                    🔊 Read Aloud
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <p style={{ fontStyle: 'italic', color: '#555' }}>Thinking & checking knowledge base... 🧠</p>}
        <div ref={chatEndRef} />
      </div>

      {/* Input Controls */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={startVoiceInput}
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: isListening ? '#dc3545' : '#28a745',
            color: '#ffffff',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          {isListening ? '🎙 Stop Listening' : '🎤 Speak'}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Speak or type your question..."
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px',
            border: '2px solid #ccc',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontSize: '16px',
            outline: 'none',
          }}
        />

        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '12px 22px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: isLoading || !input.trim() ? '#6c757d' : '#007bff',
            color: '#ffffff',
            fontWeight: 'bold',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          Send 🚀
        </button>
      </div>
    </div>
  );
};

export default ChatUI;