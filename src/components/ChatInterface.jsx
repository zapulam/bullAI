import React, { useState, useRef, useEffect } from 'react';
import { UserMessage, AssistantMessage, SystemMessage, ErrorMessage } from './ChatMessage';
import { useChat } from '../hooks/useChat';
import { useCharts } from '../hooks/useCharts';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';
import { HelpCircle, X } from 'lucide-react';

const BULL_IMAGES = [
  '/bull.png',
  '/bull_blink.png'
];

const TOOL_COMMANDS_ALWAYS_AVAILABLE = [
  { command: 'search_help_docs', description: 'Search bullAI help documentation', key: 'bullAiHelp' },
  { command: 'time_series_daily', description: 'Get daily stock price time series', key: 'tsDaily' },
  { command: 'time_series_weekly', description: 'Get weekly stock price time series', key: 'tsWeekly' },
  { command: 'time_series_monthly', description: 'Get monthly stock price time series', key: 'tsMonthly' },
  {
    command: 'sma',
    description: 'Add Simple Moving Average to chart',
    key: 'sma',
    contextPrefix: "Use time_series_daily, time_series_weekly, or time_series_monthly with screens: ['sma'] and specify time_periods. ",
  },
  {
    command: 'ema',
    description: 'Add Exponential Moving Average to chart',
    key: 'ema',
    contextPrefix: "Use time_series_daily, time_series_weekly, or time_series_monthly with screens: ['ema'] and specify time_periods. ",
  },
  {
    command: 'wma',
    description: 'Add Weighted Moving Average to chart',
    key: 'wma',
    contextPrefix: "Use time_series_daily, time_series_weekly, or time_series_monthly with screens: ['wma'] and specify time_periods. ",
  },
];

const WELCOME_HEADLINE = 'Welcome to bullAI';
const TYPING_SPEED_MS = 70;

export default function ChatInterface({
  initialSessionId,
  isSideNavOpen,
  onToggleSideNav,
  onSessionUpdate,
}) {
  const [inputValue, setInputValue] = useState('');
  const [bullImage, setbullImage] = useState(BULL_IMAGES[0]);
  const [showCommandsPopup, setShowCommandsPopup] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isApiKeyLoading, setIsApiKeyLoading] = useState(true);
  const [typedHeadline, setTypedHeadline] = useState('');
  const [isHeadlineComplete, setIsHeadlineComplete] = useState(false);
  const typewriterIndexRef = useRef(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const commandsPopupRef = useRef(null);
  const prevIsLoadingRef = useRef(false);
  const hasTriggeredRefetchRef = useRef(false);
  const { messages, isLoading, sendMessage, cancelRequest, clearChat, retryLastMessage, sessionId } = useChat(initialSessionId);
  const { saveChart } = useCharts();

  const handleSaveChart = React.useCallback(
    (payload) => {
      saveChart(payload.title, payload.visualization_data, payload.call_data);
    },
    [saveChart]
  );

  // Reset refetch trigger when session changes
  useEffect(() => {
    hasTriggeredRefetchRef.current = false;
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const SCROLL_NEAR_BOTTOM_THRESHOLD = 150;

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < SCROLL_NEAR_BOTTOM_THRESHOLD;

    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isHelpOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isHelpOpen]);

  useEffect(() => {
    const loadApiKeyStatus = async () => {
      setIsApiKeyLoading(true);
      try {
        const url = buildApiUrl(API_ENDPOINTS.SETTINGS_OPENAI_API_KEY);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load OpenAI key status: ${response.statusText}`);
        }
        const data = await response.json();
        setHasApiKey(Boolean(data.has_key));
      } catch (err) {
        setHasApiKey(false);
      } finally {
        setIsApiKeyLoading(false);
      }
    };

    loadApiKeyStatus();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Detect when message streaming completes and trigger session update for new sessions
  useEffect(() => {
    // Check if loading just completed (transitioned from true to false)
    if (prevIsLoadingRef.current && !isLoading) {
      // Check if this is the first message in a new session
      // A new session is when initialSessionId is null and we have exactly 2 messages (user + assistant)
      const isNewSession = initialSessionId === null;
      const hasFirstMessagePair = messages.length === 2 && 
        messages[0]?.role === 'user' && 
        messages[1]?.role === 'assistant';
      
      // Only trigger refetch once per new session, after the first message completes
      if (isNewSession && hasFirstMessagePair && onSessionUpdate && !hasTriggeredRefetchRef.current) {
        hasTriggeredRefetchRef.current = true;
        // Small delay to ensure backend has saved the session
        setTimeout(() => {
          onSessionUpdate();
        }, 500);
      }
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, messages, initialSessionId, onSessionUpdate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        commandsPopupRef.current &&
        !commandsPopupRef.current.contains(event.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target)
      ) {
        setShowCommandsPopup(false);
      }
    };

    if (showCommandsPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCommandsPopup]);

  useEffect(() => {
    const primaryImage = BULL_IMAGES[0];
    const alternateImages = BULL_IMAGES.slice(1);
    let timeoutId;

    const scheduleNext = () => {
      const holdDurationMs = 2500 + Math.floor(Math.random() * 2500);
      timeoutId = setTimeout(() => {
        if (alternateImages.length === 0) {
          setbullImage(primaryImage);
          scheduleNext();
          return;
        }

        const nextIndex = Math.floor(Math.random() * alternateImages.length);
        const nextImage = alternateImages[nextIndex] || primaryImage;
        setbullImage(nextImage);

        timeoutId = setTimeout(() => {
          setbullImage(primaryImage);
          scheduleNext();
        }, 500);
      }, holdDurationMs);
    };

    setbullImage(primaryImage);
    scheduleNext();

    return () => clearTimeout(timeoutId);
  }, []);

  const availableCommands = React.useMemo(() => {
    return TOOL_COMMANDS_ALWAYS_AVAILABLE.map((tool) => ({
      command: tool.command,
      description: tool.description,
      contextPrefix: tool.contextPrefix ?? `Use the ${tool.command} tool to grab data for: `,
    }));
  }, []);

  // Get filtered commands based on input
  const getFilteredCommands = () => {
    // Always work from an alphabetically sorted list of commands
    const sortedCommands = [...availableCommands].sort((a, b) =>
      a.command.localeCompare(b.command)
    );

    if (!inputValue.startsWith('/')) {
      return [];
    }
    const query = inputValue.slice(1).toLowerCase();
    if (!query) {
      return sortedCommands;
    }
    return sortedCommands.filter(cmd => 
      cmd.command.toLowerCase().startsWith(query)
    );
  };

  const filteredCommands = getFilteredCommands();
  const inputPlaceholder = isApiKeyLoading
    ? 'Checking API key status...'
    : hasApiKey
      ? 'Ask me anything... (type / for commands)'
      : 'Set your OpenAI API key in Settings to start chatting.';

  // Update commands popup visibility based on input
  useEffect(() => {
    if (inputValue.startsWith('/') && filteredCommands.length > 0) {
      setShowCommandsPopup(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandsPopup(false);
    }
  }, [inputValue, filteredCommands.length]);

  const handleCommandSelect = (command) => {
    // Extract any text that was typed after the command
    // e.g., if user typed "/hel how do I login", extract "how do I login"
    const match = inputValue.match(/^\/\w+\s+(.+)$/);
    const remainingText = match ? ` ${match[1]}` : ' ';
    setInputValue(`/${command.command}${remainingText}`);
    setShowCommandsPopup(false);
    // Set cursor position after the command and space
    setTimeout(() => {
      if (textareaRef.current) {
        const cursorPos = `/${command.command} `.length;
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isApiKeyLoading || !hasApiKey) {
      return;
    }
    if (inputValue.trim() && !isLoading) {
      let messageToSend = inputValue.trim();
      
      // Check if message starts with a command
      if (messageToSend.startsWith('/')) {
        const commandMatch = messageToSend.match(/^\/(\w+)(?:\s+(.+))?$/);
        if (commandMatch) {
          const [, commandName, userInput] = commandMatch;
          const command = availableCommands.find(cmd => cmd.command === commandName);
          if (command && userInput) {
            // Prepend context prefix to user input
            messageToSend = `${command.contextPrefix}${userInput}`;
          } else if (command && !userInput) {
            // If command is used without input, just send the command description as context
            messageToSend = `${command.contextPrefix}${command.description}`;
          }
        }
      }
      
      sendMessage(messageToSend);
      setInputValue('');
      setShowCommandsPopup(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (showCommandsPopup && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedCommandIndex];
        if (selectedCommand) {
          handleCommandSelect(selectedCommand);
          // After selecting, if there's already text after the command, submit
          const currentInput = inputValue;
          if (currentInput.includes(' ') && currentInput.substring(currentInput.indexOf(' ')).trim()) {
            setTimeout(() => handleSubmit(e), 0);
          }
        } else {
          handleSubmit(e);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandsPopup(false);
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isWelcomeScreen = messages.length === 0;

  useEffect(() => {
    if (!isWelcomeScreen) return;
    typewriterIndexRef.current = 0;
    setTypedHeadline('');
    setIsHeadlineComplete(false);
    const id = setInterval(() => {
      if (typewriterIndexRef.current >= WELCOME_HEADLINE.length) {
        setIsHeadlineComplete(true);
        clearInterval(id);
        return;
      }
      setTypedHeadline(WELCOME_HEADLINE.slice(0, typewriterIndexRef.current + 1));
      typewriterIndexRef.current += 1;
    }, TYPING_SPEED_MS);
    return () => clearInterval(id);
  }, [isWelcomeScreen]);

  return (
    <div className="flex flex-col h-full bg-surface shadow-[inset_0_0_30px_rgba(34,197,94,0.1)]">
      {/* Chat Header */}
      <div className="px-4 py-3 flex items-center justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsHelpOpen((prev) => !prev)}
            className="p-1 text-gray-300 hover:text-white hover:bg-surface-hover rounded-lg transition-colors duration-200 cursor-pointer"
            title="What can bullAI do?"
            aria-label="Open bullAI help"
          >
            <HelpCircle className="w-5.5 h-5.5" />
          </button>
          {isHelpOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-dialog-title"
            >
              <div
                className="absolute inset-0 bg-black/60 cursor-default"
                onClick={() => setIsHelpOpen(false)}
                role="presentation"
              />
              <div className="relative w-full max-w-4xl max-h-[90vh] flex justify-center items-start">
                <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
                <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-green-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
              <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-surface-elevated border border-divider rounded-xl shadow-[inset_0_0_30px_rgba(34,197,94,0.1),inset_0_0_40px_rgba(255,140,64,0.06),0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-divider bg-surface-elevated z-10">
                  <h2 id="help-dialog-title" className="text-lg font-semibold bg-gradient-to-r from-orange-400 to-green-400 text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(255,140,64,0.35)]">
                    bullAI Help
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                    aria-label="Close help"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-5 py-5 space-y-6 text-left">
                  <section>
                    <h3 className="text-lg font-semibold text-white mb-2">What can bullAI do?</h3>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                      <li>Search its own help documentation</li>
                      <li>Search financial literature to answer your questions</li>
                      <li>Look up historical financial data</li>
                      <li>Display detailed charts and visualizations</li>
                      <li>Use natural language or type <span className="font-mono text-gray-200">/</span> for focused commands (e.g. time series, indicators)</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-m font-semibold text-white mb-2">Using the chat</h3>
                    <p className="text-sm text-gray-300 mb-2">
                      Type in the input box to ask questions. Type <span className="font-mono text-gray-200">/</span> to open the commands list and pick a focused action.
                    </p>
                    <p className="text-sm text-gray-400 mb-2">
                      Available slash commands:
                    </p>
                    <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                      <li><span className="font-mono text-gray-200">search_help_docs</span> – search bullAI help documentation</li>
                      <li><span className="font-mono text-gray-200">time_series_daily</span> – get daily stock price time series</li>
                      <li><span className="font-mono text-gray-200">time_series_weekly</span> – get weekly stock price time series</li>
                      <li><span className="font-mono text-gray-200">time_series_monthly</span> – get monthly stock price time series</li>
                      <li><span className="font-mono text-gray-200">sma</span> – add Simple Moving Average to a chart</li>
                      <li><span className="font-mono text-gray-200">ema</span> – add Exponential Moving Average to a chart</li>
                      <li><span className="font-mono text-gray-200">wma</span> – add Weighted Moving Average to a chart</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-m font-semibold text-white mb-2">Alpha Vantage and stock data</h3>
                    <p className="text-sm text-gray-300 mb-2">
                      bullAI can fetch real market data (stocks, forex, crypto, fundamentals, and more) via Alpha Vantage when an API key is configured.
                    </p>
                    <h4 className="text-s font-semibold text-gray-200 mt-3 mb-1">Setup</h4>
                    <p className="text-sm text-gray-300 mb-2">
                      Add your Alpha Vantage API key in <strong>Settings</strong> under the Alpha Vantage API Key section. The key is stored locally and is only sent to Alpha Vantage when the AI requests data.
                    </p>
                    <h4 className="text-s font-semibold text-gray-200 mt-3 mb-1">How it is connected</h4>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside mb-2">
                      <li>The app uses Alpha Vantage&apos;s <strong>MCP (Model Context Protocol)</strong> server.</li>
                      <li>When you chat, the backend sends your key to Alpha Vantage&apos;s MCP endpoint so the AI can call their tools.</li>
                      <li>The AI has access to many tool categories: core stock APIs (quotes, time series, symbol search, market status), options data, Alpha Intelligence (news sentiment, earnings transcripts, gainers/losers, insider transactions, analytics), fundamental data (company overview, income statement, balance sheet, cash flow, earnings, calendars), forex, cryptocurrencies, commodities, economic indicators, and technical indicators.</li>
                    </ul>
                    <h4 className="text-s font-semibold text-gray-200 mt-3 mb-1">Time series and charts</h4>
                    <p className="text-sm text-gray-300">
                      When the AI returns time series data (e.g. daily or intraday prices), the app normalizes it (open, high, low, close, volume plus symbol and interval) and can display it in the <strong>Time Series Dashboard</strong> so you see charts from your conversations.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-white mb-2">Database and data</h3>
                    <p className="text-sm text-gray-300">
                      Conversation and app data are stored in a local SQLite database. Settings (including API keys) and chat history are kept on your machine.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-white mb-2">Tips</h3>
                    <p className="text-sm text-gray-300">
                      For better market data answers, be specific (e.g. ticker symbol, timeframe). The AI will ask for missing inputs when needed.
                    </p>
                  </section>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-6 scrollbar-none">
        <div className={`max-w-7xl mx-auto ${isWelcomeScreen ? 'flex items-center min-h-full' : ''}`}>
          {isWelcomeScreen && (
            <div className="flex flex-col items-center justify-center w-full text-center">
              <div className="mb-4 relative flex items-center justify-center animate-slide-up">
                <div className="absolute w-60 h-60" />
                <img
                  src={bullImage}
                  alt="bullAI"
                  className="w-36 h-36 object-contain z-10 drop-shadow-[0_0_32px_rgba(255,140,64,0.35)]"
                />
              </div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-green-400 text-transparent bg-clip-text drop-shadow-[0_0_32px_rgba(255,140,64,0.7)]">
                {typedHeadline}
                {!isHeadlineComplete && (
                  <span className="cursor-blink text-orange-400 ml-0.5" aria-hidden="true">|</span>
                )}
              </h1>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl animate-slide-up">
                Your AI finance helper for steady guidance.
              </p>
              {!isApiKeyLoading && !hasApiKey && (
                <p className="text-sm text-orange-300 mb-6 max-w-2xl animate-slide-up animate-delay-300">
                  Set your OpenAI API key in Settings to start chatting.
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500 animate-slide-up">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Start a conversation below to get started</span>
              </div>
            </div>
          )}

          {(() => {
            // Deduplicate messages by ID to prevent rendering the same message multiple times
            const seenIds = new Set();
            const uniqueMessages = messages.filter((message) => {
              if (seenIds.has(message.id)) {
                return false;
              }
              seenIds.add(message.id);
              return true;
            });

            return uniqueMessages.map((message) => {
              if (message.role === 'user') {
                return <UserMessage key={message.id} message={message} />;
              } else if (message.role === 'assistant') {
                // Show loading indicator only if this is the last message and it's empty and we're loading
                const isLastMessage = messages[messages.length - 1].id === message.id;
                const showLoading = isLoading && isLastMessage && !message.content;
                return (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    isLoading={showLoading}
                    onSaveChart={handleSaveChart}
                  />
                );
              } else if (message.role === 'system') {
                return <SystemMessage key={message.id} message={message} />;
              } else if (message.role === 'error') {
                return <ErrorMessage key={message.id} message={message} onRetry={retryLastMessage} />;
              }
              return null;
            });
          })()}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="px-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={isLoading || isApiKeyLoading || !hasApiKey}
                rows={1}
                className="w-full text-s align-middle bg-surface-elevated text-white align-middle rounded-lg px-4 py-3 border border-divider focus:border-green-500 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                style={{ minHeight: '42px', maxHeight: '200px', boxSizing: 'border-box' }}
              />
              
              {/* Commands Popup */}
              {showCommandsPopup && filteredCommands.length > 0 && (
                <div
                  ref={commandsPopupRef}
                  className="absolute bottom-full left-0 mb-2 w-80 bg-surface-elevated border border-divider rounded-lg shadow-2xl p-2 z-50 max-h-64 overflow-y-auto"
                >
                  <div className="mb-2 px-2">
                    <h3 className="text-xs font-semibold text-gray-400">Commands</h3>
                  </div>
                  <div className="space-y-1">
                    {filteredCommands.map((cmd, index) => (
                      <button
                        key={cmd.command}
                        type="button"
                        onClick={() => handleCommandSelect(cmd)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                          index === selectedCommandIndex
                            ? 'bg-green-600/20 border border-green-500/50'
                            : 'hover:bg-surface/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-mono text-sm">/{cmd.command}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{cmd.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {isLoading ? (
              <button
                type="button"
                onClick={cancelRequest}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center flex-shrink-0 cursor-pointer"
                style={{ height: '42px', width: '42px', padding: 0, boxSizing: 'border-box' }}
                title="Stop generating"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || isApiKeyLoading || !hasApiKey}
                className="bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 cursor-pointer"
                style={{ height: '42px', width: '42px', padding: 0, boxSizing: 'border-box' }}
                title="Send message"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            )}
          </form>
          <div className="mt-2 text-xs text-gray-500 text-center">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
