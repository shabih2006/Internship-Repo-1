import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Mic,
  Square,
  Volume2,
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
} from 'lucide-react';

export default function ChatUI() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Hello! I am your RAG Voice & Text Assistant. Ask me anything about your documents!',
      audioUrl: null,
      citations: [],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAudio, setActiveAudio] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // 1. Start Audio Recording
  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = handleVoiceSubmit;
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  // 2. Stop Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 3. Process Spoken Query
  const handleVoiceSubmit = async () => {
    setIsProcessing(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('file', audioBlob, `voice-query-${Date.now()}.mp3`);
    if (documentId) formData.append('documentId', documentId);

    await sendToBackend(formData, true);
  };

  // 4. Process Typed Query
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText;
    setInputText('');

    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'user', text: userText },
    ]);

    setIsProcessing(true);

    await sendToBackend(null, false, userText);
  };

  // 5. Send Payload to Express Backend
  const sendToBackend = async (formData, isVoice, fallbackText = '') => {
    try {
      const token = localStorage.getItem('jwtToken') || '';

      let response;

      if (isVoice) {
        // Voice Query -> /voice/upload with Multipart Form Data
        response = await axios.post('http://localhost:3000/voice/upload', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        // Text Query -> /ai/chat-rag with JSON body
        response = await axios.post(
          'http://localhost:3000/ai/chat-rag',
          {
            question: fallbackText,
            // Automatically defaults to undefined when documentId is empty for global search
            documentId: documentId ? Number(documentId) : undefined,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      const { transcript, answer, audioAnswerUrl, citations, response: ragAnswer, message } = response.data;
      const finalAnswer = answer || ragAnswer || message || 'No answer generated.';

      // If voice query, append transcribed query to chat thread
      if (isVoice) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() - 1, sender: 'user', text: transcript || 'Spoken Question' },
        ]);
      }

      // Append AI response
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'ai',
          text: finalAnswer,
          audioUrl: audioAnswerUrl || null,
          citations: citations || [],
        },
      ]);
    } catch (err) {
      console.error('API Error:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Sorry, I encountered an error processing your query. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'ai',
          text: errorMessage,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            RAG Dual Voice & Text Chatbot
          </h1>
        </div>
      </header>

      {/* Main Chat Thread Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* AI Avatar */}
            {msg.sender === 'ai' && (
              <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`max-w-2xl p-4 rounded-2xl space-y-3 shadow-lg ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>

              {/* Optional Audio Player toggle for AI responses */}
              {msg.sender === 'ai' && msg.audioUrl && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-3">
                  <button
                    onClick={() =>
                      setActiveAudio(activeAudio === msg.audioUrl ? null : msg.audioUrl)
                    }
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{activeAudio === msg.audioUrl ? 'Hide Audio Player' : 'Listen to Audio'}</span>
                  </button>

                  {/* Inline Audio Player */}
                  {activeAudio === msg.audioUrl && (
                    <audio controls autoPlay src={msg.audioUrl} className="h-8 w-60" />
                  )}
                </div>
              )}

              {/* Source Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="pt-2 border-t border-slate-800 text-xs space-y-1">
                  <span className="font-semibold text-slate-400">Sources:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {msg.citations.map((c, i) => (
                      <span
                        key={i}
                        className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400 border border-slate-700"
                      >
                        Doc #{c.documentId} (Chunk #{c.chunkIndex})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar */}
            {msg.sender === 'user' && (
              <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isProcessing && (
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-bl-none flex items-center space-x-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Thinking & synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* Bottom Controls Bar */}
      <footer className="p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleTextSubmit} className="max-w-4xl mx-auto flex items-center space-x-3">
          
          {/* Microphone Recording Button */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`p-3 rounded-xl transition-all shadow-md ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={isRecording ? 'Stop Recording' : 'Hold to Speak'}
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input Box */}
          <input
            type="text"
            placeholder={isRecording ? 'Listening to your voice...' : 'Type your question or use voice...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isRecording || isProcessing}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition"
          />

          {/* Send Text Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing || isRecording}
            className="p-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-semibold rounded-xl transition shadow-md cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>

    </div>
  );
}