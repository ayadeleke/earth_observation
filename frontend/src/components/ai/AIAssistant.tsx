/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Sparkles, X, Minimize2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import authService from '../../services/authService';
import { useLocation } from 'react-router-dom';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  analysisData?: any;
  suggestions?: string[];
}

interface AIAssistantProps {
  analysisData?: any;
  className?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ 
  analysisData, 
  className = '' 
}) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get context-aware suggestions based on current page
  const getContextualSuggestions = () => {
    const path = location.pathname;
    
    if (analysisData) {
      return [
        "What are the key insights from this analysis?",
        "Explain the trends in my data",
        "What do these statistics mean?",
        "Are there any anomalies in the results?"
      ];
    }
    
    switch (path) {
      case '/analysis':
        return [
          "How do I start an NDVI analysis?",
          "What's the difference between Landsat and Sentinel?",
          "How do I interpret analysis results?",
          "What cloud cover percentage should I use?"
        ];
      case '/dashboard':
        return [
          "How do I create a new project?",
          "What analysis types are available?",
          "How do I export my results?",
          "What are the data sources?"
        ];
      case '/projects':
        return [
          "How do I organize my projects?",
          "What file formats are supported?",
          "How do I share analysis results?",
          "Can I compare different analyses?"
        ];
      case '/settings':
        return [
          "How do I configure Earth Engine?",
          "What are the authentication requirements?",
          "How do I manage my account?",
          "What are the usage limits?"
        ];
      default:
        return [
          "What is NDVI?",
          "How does SAR work?",
          "Explain Land Surface Temperature",
          "What can I do with this platform?"
        ];
    }
  };

  // Get context-aware welcome message
  const getWelcomeMessage = () => {
    const path = location.pathname;
    
    if (analysisData) {
      return `Hello! I can help you understand your ${analysisData.analysisType?.toUpperCase() || 'analysis'} results. Ask me about trends, statistics, or any patterns you'd like to explore!`;
    }
    
    switch (path) {
      case '/analysis':
        return `Hello! I'm here to help you with satellite data analysis. I can guide you through setting up analyses, interpreting results, and understanding earth observation concepts.`;
      case '/dashboard':
        return `Welcome to your dashboard! I can help you navigate the platform, understand available features, and get started with your earth observation projects.`;
      case '/projects':
        return `I'm here to help you manage your projects and analyses. Ask me about organizing your work, comparing results, or understanding your data.`;
      case '/settings':
        return `I can help you configure your account settings, set up Earth Engine authentication, and understand platform requirements.`;
      default:
        return `Hello! I'm your AI assistant. I can help you with earth observation concepts, satellite data analysis, remote sensing questions, and much more. What would you like to know?`;
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message 
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: getWelcomeMessage(),
        timestamp: new Date(),
        suggestions: getContextualSuggestions()
      };
      setMessages([welcomeMessage]);
    }
  }, [analysisData, messages.length, location.pathname, getWelcomeMessage, getContextualSuggestions]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Debug authentication
      const token = authService.getAccessToken();
      console.log('AI Assistant - Token available:', !!token);
      console.log('AI Assistant - Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
      
      // Call AI service to process the query
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'}/ai/query/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: inputMessage,
          analysisData: analysisData,
          context: messages.slice(-5) // Last 5 messages for context
        })
      });

      if (response.ok) {
        const aiResponse = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: aiResponse.response,
          timestamp: new Date(),
          suggestions: aiResponse.suggestions
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`btn btn-primary position-fixed d-flex align-items-center gap-2 shadow-lg ${className}`}
        style={{
          bottom: '20px',
          right: '20px',
          borderRadius: '50px',
          padding: '12px 20px',
          zIndex: 1000,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none'
        }}
      >
        <Brain size={20} />
        <span className="fw-semibold">AI Assistant</span>
        <Sparkles size={16} className="text-warning" />
      </button>
    );
  }

  return (
    <div
      className={`position-fixed bg-white shadow-lg border rounded-3 ${className}`}
      style={{
        bottom: '20px',
        right: '20px',
        width: isMinimized ? '320px' : '400px',
        height: isMinimized ? '60px' : '600px',
        zIndex: 1000,
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header - Always visible */}
      <div 
        className="d-flex align-items-center justify-content-between p-3 border-bottom"
        style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          flexShrink: 0,
          minHeight: '60px',
          position: 'relative',
          zIndex: 1050
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <Brain size={20} />
          <span className="fw-semibold">Earth Observation Assistant</span>
          <Sparkles size={14} className="text-warning" />
        </div>
        <div className="d-flex gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="btn btn-sm text-white border-0"
            style={{ 
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '14px',
              fontWeight: '600',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="btn btn-sm text-white border-0"
            style={{ 
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '14px',
              fontWeight: '600',
              minWidth: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title="Close  Assistant"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div 
            className="overflow-auto p-3"
            style={{ 
              flex: 1,
              height: 'calc(100% - 120px)',
              maxHeight: 'calc(100% - 120px)'
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-3 ${message.type === 'user' ? 'text-end' : 'text-start'}`}
              >
                <div
                  className={`d-inline-block p-3 rounded-3 ${
                    message.type === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-light text-dark border'
                  }`}
                  style={{ 
                    maxWidth: '85%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  <div className="mb-1">
                    {message.type === 'assistant' ? (
                      <div 
                        className="markdown-content"
                        style={{
                          fontSize: '0.95rem',
                          lineHeight: '1.6'
                        }}
                      >
                        <ReactMarkdown
                          components={{
                            // Style strong/bold text with better color
                            strong: ({children}) => (
                              <strong className="fw-bold" style={{color: '#0d6efd'}}>{children}</strong>
                            ),
                            // Style emphasis/italic text  
                            em: ({children}) => <em className="fst-italic">{children}</em>,
                            // Style headings with better spacing
                            h1: ({children}) => (
                              <h5 className="fw-bold mb-2 mt-2" style={{color: '#0d6efd'}}>{children}</h5>
                            ),
                            h2: ({children}) => (
                              <h6 className="fw-bold mb-2 mt-2" style={{color: '#6c757d'}}>{children}</h6>
                            ),
                            h3: ({children}) => (
                              <div className="fw-bold mb-2 mt-2">{children}</div>
                            ),
                            // Style lists with proper spacing
                            ul: ({children}) => (
                              <ul style={{
                                marginBottom: '0.75rem', 
                                paddingLeft: '1.25rem',
                                lineHeight: '1.6'
                              }}>{children}</ul>
                            ),
                            ol: ({children}) => (
                              <ol style={{
                                marginBottom: '0.75rem', 
                                paddingLeft: '1.25rem',
                                lineHeight: '1.6'
                              }}>{children}</ol>
                            ),
                            li: ({children}) => (
                              <li style={{
                                marginBottom: '0.25rem',
                                lineHeight: '1.6'
                              }}>{children}</li>
                            ),
                            // Style paragraphs with proper spacing
                            p: ({children}) => (
                              <div style={{
                                marginBottom: '0.75rem',
                                lineHeight: '1.6'
                              }}>{children}</div>
                            ),
                            // Style code with better appearance
                            code: ({children}) => (
                              <code style={{
                                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                                color: '#0d6efd',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.9em',
                                border: '1px solid rgba(13, 110, 253, 0.2)'
                              }}>{children}</code>
                            ),
                            // Style blockquotes
                            blockquote: ({children}) => (
                              <div style={{
                                borderLeft: '3px solid #0d6efd',
                                paddingLeft: '1rem',
                                marginLeft: '0.5rem',
                                fontStyle: 'italic',
                                color: '#6c757d',
                                marginBottom: '0.75rem'
                              }}>{children}</div>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div style={{
                        lineHeight: '1.5', 
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.95rem'
                      }}>{message.content}</div>
                    )}
                  </div>
                  {message.suggestions && (
                    <div className="mt-2">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="btn btn-outline-secondary btn-sm me-1 mb-1"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div 
                  className="small text-muted mt-1"
                  style={{ fontSize: '0.7rem' }}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="text-start mb-3">
                <div className="d-inline-block bg-light border p-3 rounded-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="text-muted">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-top">
            <div className="input-group">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your analysis results..."
                className="form-control"
                rows={2}
                style={{ resize: 'none' }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="btn btn-primary"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="small text-muted mt-1">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;