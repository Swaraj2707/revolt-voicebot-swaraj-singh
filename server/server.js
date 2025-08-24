const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System instructions for Revolt Motors
const SYSTEM_INSTRUCTIONS = `You are Rev, the AI assistant for Revolt Motors. You help customers with information about Revolt electric vehicles, including:

- Vehicle specifications and features
- Pricing and financing options
- Charging infrastructure and range
- Maintenance and service
- Test drive bookings
- General inquiries about electric vehicles

Always be helpful, informative, and enthusiastic about electric mobility. Keep responses concise but informative. If asked about topics unrelated to Revolt Motors or electric vehicles, politely redirect the conversation back to how you can help with Revolt Motors.`;

// Store active conversations
const activeConversations = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('start_conversation', async () => {
    try {
             // Initialize Gemini Live conversation
       const model = genAI.getGenerativeModel({ 
         model: "gemini-1.0-pro"  // Try the most basic model
       });
      
      const chat = model.startChat({
        systemInstruction: SYSTEM_INSTRUCTIONS,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        },
      });

      activeConversations.set(socket.id, { chat, isSpeaking: false });
      
      socket.emit('conversation_started', { 
        message: 'Hello! I\'m Rev, your Revolt Motors AI assistant. How can I help you today?' 
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      socket.emit('error', { message: 'Failed to start conversation' });
    }
  });

  socket.on('audio_input', async (audioData) => {
    try {
      const conversation = activeConversations.get(socket.id);
      if (!conversation) {
        socket.emit('error', { message: 'No active conversation' });
        return;
      }

      // Check if this is text input (for testing) or actual audio
      let userInput;
      let isVoiceInput = false;
      
      try {
        // Try to decode as text first (for testing)
        const textBytes = Buffer.from(audioData, 'base64');
        userInput = textBytes.toString('utf8');
        
        // Check if this is actually readable text
        if (userInput.length > 0 && userInput.length < 1000 && /^[\x00-\x7F]*$/.test(userInput)) {
          console.log('Received text input:', userInput);
        } else {
          // This is likely audio data
          isVoiceInput = true;
          userInput = "Voice message received";
          console.log('Received voice input (audio data)');
        }
      } catch (e) {
        // If not text, treat as audio
        isVoiceInput = true;
        userInput = "Voice message received";
        console.log('Received voice input (could not decode as text)');
      }

      // TEMPORARY: Mock responses while API key issues are resolved
      let mockResponse;
      
      if (isVoiceInput) {
        // For voice input, try to provide a more helpful response based on common keywords
        // Since we can't transcribe the actual speech, we'll give a comprehensive but engaging response
        mockResponse = "Excellent! I heard your voice message. I'm Rev from Revolt Motors, and I'm here to help with all your electric vehicle questions! Our electric scooters offer amazing features - the RV300 gives you up to 180 km range, while the RV400 offers up to 200 km. Charging takes just 4-5 hours, and we have competitive pricing starting from ₹1.25 lakhs. We also offer test drives for all models. What specific information would you like to know about our electric vehicles?";
      } else if (userInput.toLowerCase().includes('hi') || userInput.toLowerCase().includes('hello')) {
        mockResponse = "Hello! I'm Rev from Revolt Motors. How can I help you with our electric vehicles today?";
      } else if (userInput.toLowerCase().includes('test drive')) {
        mockResponse = "Great choice! Revolt Motors offers test drives for all our electric vehicles. You can book one through our website or call our dealership. Which model interests you most?";
      } else if (userInput.toLowerCase().includes('price') || userInput.toLowerCase().includes('cost')) {
        mockResponse = "Revolt Motors offers competitive pricing on all our electric vehicles. Our prices start from ₹1.25 lakhs for the RV300 and go up to ₹1.45 lakhs for the RV400. Would you like specific pricing for a particular model?";
      } else if (userInput.toLowerCase().includes('charge') || userInput.toLowerCase().includes('range') || userInput.toLowerCase().includes('battery') || userInput.toLowerCase().includes('km') || userInput.toLowerCase().includes('kilometer')) {
        mockResponse = "Our electric vehicles offer excellent range! The RV300 provides up to 180 km on a single charge, while the RV400 offers up to 200 km. Charging takes about 4-5 hours with our standard charger. We also have fast-charging options available.";
      } else if (userInput.toLowerCase().includes('about') && userInput.toLowerCase().includes('yourself')) {
        mockResponse = "I'm Rev, your AI assistant for Revolt Motors! I'm here to help you learn about our amazing electric vehicles. I can tell you about our models (RV300 and RV400), pricing, test drives, charging, range, and any other details about our electric scooters. What would you like to know?";
      } else if (userInput.toLowerCase().includes('model') || userInput.toLowerCase().includes('rv300') || userInput.toLowerCase().includes('rv400')) {
        mockResponse = "Revolt Motors offers two excellent electric scooter models: The RV300 with up to 180 km range and the RV400 with up to 200 km range. Both models feature modern design, reliable performance, and eco-friendly technology. Which model interests you most?";
      } else {
        mockResponse = "That's a great question about Revolt Motors! I'd be happy to help you with information about our electric vehicles, pricing, test drives, or any other inquiries. What specific information are you looking for?";
      }

      // Mark as speaking
      conversation.isSpeaking = true;
      activeConversations.set(socket.id, conversation);

      // Send mock response back to client
      socket.emit('ai_response', { 
        text: mockResponse,
        audio: null
      });

      // Mark as not speaking
      conversation.isSpeaking = false;
      activeConversations.set(socket.id, conversation);

    } catch (error) {
      console.error('Error processing input:', error);
      socket.emit('error', { message: `Failed to process input: ${error.message}` });
    }
  });

  socket.on('interrupt', () => {
    const conversation = activeConversations.get(socket.id);
    if (conversation && conversation.isSpeaking) {
      conversation.isSpeaking = false;
      activeConversations.set(socket.id, conversation);
      socket.emit('interruption_acknowledged', { message: 'I\'m listening...' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    activeConversations.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
