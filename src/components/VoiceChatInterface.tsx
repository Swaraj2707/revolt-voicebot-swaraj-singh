import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './VoiceChatInterface.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const VoiceChatInterface: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Initialize Socket.IO connection
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('conversation_started', (data) => {
      addMessage('ai', data.message);
    });

    newSocket.on('ai_response', (data) => {
      addMessage('ai', data.text);
      if (data.audio) {
        playAudio(data.audio);
      } else {
        // Convert text to speech using Web Speech API
        speakText(data.text);
      }
    });

    newSocket.on('interruption_acknowledged', (data) => {
      addMessage('ai', data.message);
      setIsAISpeaking(false);
    });

    newSocket.on('error', (data) => {
      console.error('Server error:', data.message);
      addMessage('ai', `Error: ${data.message}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const addMessage = (sender: 'user' | 'ai', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const startConversation = () => {
    if (socket) {
      socket.emit('start_conversation');
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Try different audio formats for better compatibility
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
      } catch (e) {
        try {
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
          });
        } catch (e2) {
          mediaRecorder = new MediaRecorder(stream);
        }
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
          });
          
          // Convert to base64 for transmission
          const arrayBuffer = await audioBlob.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          if (socket) {
            // For now, send a mock response since we're using the mock system
            // In a real implementation, this would send the audio to Gemini API
            addMessage('user', '🎤 Voice message recorded');
            socket.emit('audio_input', base64Audio);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          addMessage('ai', 'Error: Could not process audio recording');
        } finally {
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        }
      };

      // Start recording with 1-second chunks for better control
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsListening(true);
      
      // Add user message indicator
      addMessage('user', '🎤 Listening... Speak now!');
      
      console.log('Recording started successfully');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          addMessage('ai', 'Error: Microphone access denied. Please allow microphone permissions and try again.');
        } else if (error.name === 'NotFoundError') {
          addMessage('ai', 'Error: No microphone found. Please connect a microphone and try again.');
        } else {
          addMessage('ai', `Error: Could not access microphone - ${error.message}`);
        }
      } else {
        addMessage('ai', 'Error: Could not access microphone - Unknown error');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
    }
  };

  const interruptAI = () => {
    if (socket && isAISpeaking) {
      socket.emit('interrupt');
      setIsAISpeaking(false);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => {
        setIsAISpeaking(true);
      };
      
      utterance.onend = () => {
        setIsAISpeaking(false);
      };
      
      utterance.onerror = () => {
        setIsAISpeaking(false);
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const playAudio = (audioData: string) => {
    // Implementation for playing audio from base64 data
    // This would be used when the AI provides audio responses
    console.log('Playing audio response');
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const sendTextMessage = (text: string) => {
    if (socket && text.trim()) {
      addMessage('user', text);
      // Simulate audio input with text for testing
      const textBytes = new TextEncoder().encode(text);
      const base64Text = btoa(String.fromCharCode(...textBytes));
      socket.emit('audio_input', base64Text);
    }
  };

  return (
    <div className="voice-chat-interface">
      <div className="chat-container">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <h3>Welcome to Revolt Motors Voice Assistant!</h3>
              <p>Click "Start Conversation" to begin talking with Rev, your AI assistant.</p>
              <p>You can ask about:</p>
              <ul>
                <li>Vehicle specifications and features</li>
                <li>Pricing and financing options</li>
                <li>Charging infrastructure</li>
                <li>Test drive bookings</li>
              </ul>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`}
              >
                <div className="message-content">
                  {message.sender === 'user' && message.text === '🎤 Listening...' ? (
                    <div className="listening-indicator">
                      <span className="pulse">🎤</span> Listening...
                    </div>
                  ) : (
                    <p>{message.text}</p>
                  )}
                </div>
                <div className="message-timestamp">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="controls">
          {!isConnected ? (
            <div className="connection-status">
              <span className="status-indicator disconnected"></span>
              Connecting to server...
            </div>
          ) : (
            <>
              {messages.length === 0 ? (
                <button 
                  className="start-btn"
                  onClick={startConversation}
                >
                  Start Conversation
                </button>
              ) : (
                <div className="recording-controls">
                  {!isRecording ? (
                    <button 
                      className="record-btn"
                      onClick={startRecording}
                      disabled={isAISpeaking}
                    >
                      🎤 Start Recording
                    </button>
                  ) : (
                    <button 
                      className="stop-btn"
                      onClick={stopRecording}
                    >
                      ⏹️ Stop Recording
                    </button>
                  )}
                  
                  {isAISpeaking && (
                    <button 
                      className="interrupt-btn"
                      onClick={interruptAI}
                    >
                      🔇 Interrupt AI
                    </button>
                  )}
                  
                  <button 
                    className="clear-btn"
                    onClick={clearMessages}
                  >
                    🗑️ Clear Chat
                  </button>
                  
                  <div className="text-input-container">
                    <input
                      type="text"
                      placeholder="Type a message to test AI responses..."
                      className="text-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          sendTextMessage(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <button 
                      className="send-btn"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input) {
                          sendTextMessage(input.value);
                          input.value = '';
                        }
                      }}
                    >
                      📤 Send
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="status-bar">
          <div className="status-item">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="status-item">
            <span className={`status-indicator ${isRecording ? 'recording' : 'idle'}`}></span>
            {isRecording ? 'Recording' : 'Idle'}
          </div>
          <div className="status-item">
            <span className={`status-indicator ${isAISpeaking ? 'speaking' : 'listening'}`}></span>
            {isAISpeaking ? 'AI Speaking' : 'Listening'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceChatInterface;
