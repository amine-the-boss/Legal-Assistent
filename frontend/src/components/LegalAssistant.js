import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { UserCircle, Bot, Send, Plus, LogOut, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';


const Login = ({ setToken, setAuthView }) => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/login/', credentials);
      setToken(response.data.token);
    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.response?.data?.error || 'An unexpected error occurred.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        name="email"
        value={credentials.email}
        onChange={handleChange}
        placeholder="Email or Username"
        required
        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      />
      <input
        type="password"
        name="password"
        value={credentials.password}
        onChange={handleChange}
        placeholder="Password"
        required
        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition duration-300 text-sm">
        Log In
      </button>
      <p className="text-center text-xs text-gray-600">
        Don't have an account?{' '}
        <button
          onClick={() => setAuthView('signup')}
          className="text-blue-500 hover:underline focus:outline-none"
        >
          Sign up
        </button>
      </p>
    </form>
  );
};

const Signup = ({ setToken, setAuthView }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/signup/', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName
      });
      setToken(response.data.token);
    } catch (error) {
      console.error('Error signing up:', error);
      setError(error.response?.data?.error || 'An unexpected error occurred.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {['username', 'email', 'password', 'firstName', 'lastName'].map((field) => (
        <input
          key={field}
          type={field === 'password' ? 'password' : 'text'}
          name={field}
          value={formData[field]}
          onChange={handleChange}
          placeholder={field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
          required={field !== 'firstName' && field !== 'lastName'}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      ))}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition duration-300 text-sm">
        Sign Up
      </button>
      <p className="text-center text-xs text-gray-600">
        Already have an account?{' '}
        <button
          onClick={() => setAuthView('login')}
          className="text-blue-500 hover:underline focus:outline-none"
        >
          Log in
        </button>
      </p>
    </form>
  );
};

const MarkdownRenderer = ({ children }) => (
  <ReactMarkdown
    components={{
      h1: ({ node, ...props }) => <h1 className="text-xl font-semibold text-gray-800 mb-3" {...props} />,
      h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-gray-800 mb-2" {...props} />,
      h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-gray-800 mb-2" {...props} />,
      p: ({ node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
      ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3" {...props} />,
      ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3" {...props} />,
      li: ({ node, ...props }) => <li className="ml-2 mb-1" {...props} />,
      strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
      em: ({ node, ...props }) => <em className="italic" {...props} />,
      blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-gray-300 pl-3 py-1 mb-3 italic" {...props} />,
      a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" {...props} />,
    }}
  >
    {children}
  </ReactMarkdown>
);

const LegalAssistant = () => {
  const [language, setLanguage] = useState('French');
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [conversationId, setConversationId] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchConversations();
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/conversation-history/', {
        headers: { 'Authorization': `Token ${token}` }
      });
      setConversations(response.data);
      if (response.data.length > 0) {
        setConversationId(response.data[0].id);
        setChatHistory(response.data[0].messages);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const deleteConversation = async (id) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await axios.delete(`http://localhost:8000/api/delete-conversation/${id}/`, {
          headers: { 'Authorization': `Token ${token}` }
        });
        setConversations(prevConversations => prevConversations.filter(conv => conv.id !== id));
        if (id === conversationId) {
          const newConversations = conversations.filter(conv => conv.id !== id);
          if (newConversations.length > 0) {
            setConversationId(newConversations[0].id);
            setChatHistory(newConversations[0].messages);
          } else {
            setConversationId(null);
            setChatHistory([]);
          }
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsLoading(true);
  
    try {
      const response = await axios.post('http://localhost:8000/api/legal-assistant/', {
        language,
        prompt,
        conversation_id: conversationId,
      }, {
        headers: { 'Authorization': `Token ${token}` }
      });

      setChatHistory(prevHistory => [...prevHistory, { role: 'user', content: prompt }, { role: 'assistant', content: response.data.answer }]);
      setConversationId(response.data.conversation_id);
      setPrompt('');
    } catch (error) {
      console.error('Error:', error);
      setChatHistory(prevHistory => [...prevHistory, { role: 'user', content: prompt }, { role: 'assistant', content: 'An error occurred while processing your request.' }]);
      if (error.response && error.response.status === 403) {
        setToken(null);
      }
    }

    setIsLoading(false);
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:8000/api/logout/', {}, {
        headers: { 'Authorization': `Token ${token}` }
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
    setToken(null);
    setConversationId(null);
    setChatHistory([]);
    setConversations([]);
  };

  const selectConversation = (id) => {
    const selectedConversation = conversations.find(conv => conv.id === id);
    if (selectedConversation) {
      setConversationId(id);
      setChatHistory(selectedConversation.messages);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/create-conversation/', {}, {
        headers: { 'Authorization': `Token ${token}` }
      });
      setConversationId(response.data.id);
      setChatHistory([]);
      setConversations(prevConversations => [response.data, ...prevConversations]);
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
  };

  if (!token) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
            {authView === 'login' ? 'Log In' : 'Sign Up'}
          </h2>
          {authView === 'login' ? (
            <Login setToken={setToken} setAuthView={setAuthView} />
          ) : (
            <Signup setToken={setToken} setAuthView={setAuthView} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-14'} bg-white shadow-md flex flex-col transition-all duration-300 ease-in-out`}>
        <div className="p-3 flex items-center justify-between border-b border-gray-200">
          <h1 className={`text-lg font-semibold text-gray-800 ${isSidebarOpen ? '' : 'hidden'}`}>Legal Assistant</h1>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        {isSidebarOpen && (
          <>
            <div className="p-3">
              <button 
                onClick={createNewConversation}
                className="w-full bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center text-sm"
              >
                <Plus size={16} className="mr-2" /> New Conversation
              </button>
            </div>
            <div className="px-3 mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="French">French</option>
                <option value="English">English</option>
                <option value="عربي">عربي</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              <h2 className="text-xs font-semibold mb-2 text-gray-600 uppercase">Conversations</h2>
              {conversations.map((conv) => (
                <div key={conv.id} className="flex items-center mb-1">
                  <button
                    onClick={() => selectConversation(conv.id)}
                    className={`flex-grow text-left p-2 rounded-md transition-colors text-sm ${conv.id === conversationId ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                  >
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 focus:outline-none"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200">
              <button onClick={handleLogout} className="w-full bg-red-500 text-white py-2 px-3 rounded-md hover:bg-red-600 transition-colors flex items-center justify-center text-sm">
                <LogOut size={16} className="mr-2" /> Log Out
              </button>
            </div>
          </>
        )}
      </div>
     {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4  ">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-3/4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 ${msg.role === 'user' ? 'ml-2' : 'mr-2'}`}>
                  {msg.role === 'user' ? (
                    <UserCircle size={32} className="text-blue-500" />
                  ) : (
                    <Bot size={32} className="text-green-500" />
                  )}
                </div>
                <div className={`rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-500 text-white'
                    : 'bg-white shadow-sm border border-gray-200'
                }`}>
                  <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
  
        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-200">
          <div className="flex space-x-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your legal question"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition duration-300 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LegalAssistant;

   