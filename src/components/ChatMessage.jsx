import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VizChart from './VizChart';

// Format UTC timestamps from the backend into the user's local time.
// When isHistory is true, show date + time (MM/DD/YY, HH:MM); otherwise time only.
const formatTimeFromTimestamp = (rawTimestamp, isHistory = false) => {
  if (!rawTimestamp) return null;

  let timestampValue = rawTimestamp;

  // If timestamp is an array, use the first valid one
  if (Array.isArray(timestampValue)) {
    timestampValue = timestampValue.find(ts => ts);
    if (!timestampValue) return null;
  }

  // Normalize common SQLite UTC format "YYYY-MM-DD HH:MM:SS[.fractional]"
  // into an ISO-like UTC string so Date parses it as UTC.
  if (typeof timestampValue === 'string') {
    let normalized = timestampValue.trim();

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized) && !normalized.includes('T')) {
      const [datePart, timePartWithFrac] = normalized.split(' ');
      const timePart = timePartWithFrac.split('.')[0];
      normalized = `${datePart}T${timePart}Z`;
    }

    timestampValue = normalized;
  }

  const date = new Date(timestampValue);
  if (Number.isNaN(date.getTime())) return null;

  // Let the browser convert from UTC to the user's local timezone.
  if (isHistory) {
    // Show date + time for messages loaded from history
    return date.toLocaleString([], {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // For live messages, show time only
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function buildFollowUpReply(steps, openText, choiceSingle, choiceMulti, otherText) {
  const blocks = [];
  steps.forEach((step, i) => {
    const n = i + 1;
    if (step.type === 'choice_question') {
      let picked = [];
      if (step.allow_multiple) {
        picked = [...(choiceMulti[i] || [])];
      } else if (choiceSingle[i]) {
        picked = [choiceSingle[i]];
      }
      const parts = [...picked];
      const ot = (otherText[i] || '').trim();
      if (step.allow_other && ot) {
        parts.push(`Other: ${ot}`);
      }
      blocks.push(`${n}) ${parts.join('; ')}`);
    } else {
      blocks.push(`${n}) ${(openText[i] || '').trim()}`);
    }
  });
  return blocks.join('\n\n');
}

function followUpFormIsValid(steps, openText, choiceSingle, choiceMulti, otherText) {
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (step.type === 'choice_question') {
      const hasMulti = step.allow_multiple && (choiceMulti[i] || []).length > 0;
      const hasSingle = !step.allow_multiple && choiceSingle[i];
      const hasOther = step.allow_other && (otherText[i] || '').trim();
      if (!hasMulti && !hasSingle && !hasOther) {
        return false;
      }
    } else {
      if (!(openText[i] || '').trim()) {
        return false;
      }
    }
  }
  return true;
}

const FollowUpOptionsForm = forwardRef(function FollowUpOptionsForm(
  { messageId, steps, externalError, onDismissExternalError },
  ref
) {
  const [openText, setOpenText] = useState({});
  const [choiceSingle, setChoiceSingle] = useState({});
  const [choiceMulti, setChoiceMulti] = useState({});
  const [otherText, setOtherText] = useState({});

  const dismissExternal = useCallback(() => {
    onDismissExternalError?.();
  }, [onDismissExternalError]);

  useEffect(() => {
    setOpenText({});
    setChoiceSingle({});
    setChoiceMulti({});
    setOtherText({});
  }, [messageId]);

  useImperativeHandle(
    ref,
    () => ({
      compose: () => buildFollowUpReply(steps, openText, choiceSingle, choiceMulti, otherText),
      isValid: () => followUpFormIsValid(steps, openText, choiceSingle, choiceMulti, otherText),
    }),
    [steps, openText, choiceSingle, choiceMulti, otherText]
  );

  const toggleMulti = (index, label) => {
    dismissExternal();
    setChoiceMulti((prev) => {
      const cur = prev[index] || [];
      const has = cur.includes(label);
      const next = has ? cur.filter((x) => x !== label) : [...cur, label];
      return { ...prev, [index]: next };
    });
  };

  const choiceChipClass = (selected) =>
    `w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
      selected
        ? 'bg-green-600/20 text-gray-50 border-green-500/45 ring-1 ring-green-500/20'
        : 'text-gray-300 border-divider/80 hover:border-green-500/45 hover:bg-green-600/10 hover:text-gray-100'
    }`;

  return (
    <div className="mt-3 w-full max-w-full text-left space-y-2">
      {steps.map((step, i) => {
        const prompt = typeof step.prompt === 'string' ? step.prompt : '';
        const choices = Array.isArray(step.choices) ? step.choices : [];

        return (
          <div key={i} className="space-y-2.5">
            <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{prompt}</div>

            {step.type === 'choice_question' && (
              <div className="space-y-1.5">
                {step.allow_multiple
                  ? choices.map((c) => {
                      const selected = (choiceMulti[i] || []).includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleMulti(i, c)}
                          className={choiceChipClass(selected)}
                        >
                          {c}
                        </button>
                      );
                    })
                  : choices.map((c) => {
                      const selected = choiceSingle[i] === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            dismissExternal();
                            setChoiceSingle((prev) => ({ ...prev, [i]: c }));
                          }}
                          className={choiceChipClass(selected)}
                        >
                          {c}
                        </button>
                      );
                    })}
                {step.allow_other && (
                  <textarea
                    value={otherText[i] || ''}
                    onChange={(e) => {
                      dismissExternal();
                      setOtherText((prev) => ({ ...prev, [i]: e.target.value }));
                    }}
                    rows={1}
                    className={`w-full rounded-lg px-3 py-2.5 text-sm leading-5 text-gray-100 resize-y min-h-[2.5rem] max-h-48 transition-colors bg-transparent border box-border ${
                      (otherText[i] || '').trim()
                        ? 'border-green-500/40 bg-green-600/10 ring-1 ring-green-500/20'
                        : 'border-divider/80 hover:border-green-500/45 hover:bg-green-600/5'
                    } placeholder:text-gray-500`}
                    placeholder="Other"
                  />
                )}
              </div>
            )}

            {(step.type === 'open_question' || step.type !== 'choice_question') && (
              <textarea
                value={openText[i] || ''}
                onChange={(e) => {
                  dismissExternal();
                  setOpenText((prev) => ({ ...prev, [i]: e.target.value }));
                }}
                rows={3}
                className="w-full rounded-lg bg-transparent border border-divider/80 hover:border-green-500/45 hover:bg-green-600/5 focus:border-green-500/35 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 resize-y min-h-[4rem] focus:outline-none focus:ring-1 focus:ring-green-500/25"
                placeholder="Your answer…"
              />
            )}
          </div>
        );
      })}

      {externalError && (
        <p className="text-xs text-amber-400/90 pt-1">{externalError}</p>
      )}
    </div>
  );
});

const followUpReadOnlyChoiceClass =
  'w-full text-left text-sm px-3 py-2.5 rounded-lg border text-gray-300 border-divider/80';

function FollowUpOptionsReadOnlyRecap({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="mt-3 w-full max-w-full text-left space-y-2">
      <p className="text-xs text-gray-500">From earlier in this conversation</p>
      {steps.map((step, i) => {
        const prompt = typeof step.prompt === 'string' ? step.prompt : '';
        const choices = Array.isArray(step.choices) ? step.choices : [];

        return (
          <div key={i} className="space-y-2.5">
            <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{prompt}</div>

            {step.type === 'choice_question' && (
              <div className="space-y-1.5">
                {choices.map((c) => (
                  <div key={c} className={followUpReadOnlyChoiceClass}>
                    {c}
                  </div>
                ))}
                {step.allow_other && (
                  <div
                    className={`${followUpReadOnlyChoiceClass} text-gray-500 min-h-[2.5rem] flex items-center box-border`}
                  >
                    Other
                  </div>
                )}
              </div>
            )}

            {(step.type === 'open_question' || step.type !== 'choice_question') && (
              <div className="w-full rounded-lg bg-transparent border border-divider/80 px-3 py-2 text-sm min-h-[4rem] box-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function UserMessage({ message }) {
  // Safely extract and format timestamp - ensure it's only rendered once
  const formatTimestamp = React.useMemo(() => {
    const rawTimestamp =
      message?.timestamp ?? message?.created_at ?? message?.time ?? null;
    const formatted = formatTimeFromTimestamp(rawTimestamp, message?.isHistory);
    if (!formatted) return null;

    // Don't show timestamp if it's already in the message content
    if (message?.content && message.content.includes(formatted)) {
      return null;
    }

    return formatted;
  }, [message?.timestamp, message?.created_at, message?.time, message?.isHistory, message?.content]);

  const timestamp = formatTimestamp;

  return (
    <div className="flex justify-end mb-4 animate-fade-in chat-font">
      <div className="flex items-start space-x-3">
        <div className="flex-1">
          <div className="bg-green-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md">
            <p className="text-sm leading-normal whitespace-normal break-words">{message.content}</p>
            {timestamp && (
              <span key="timestamp" className="text-xs text-green-200 mt-1 block text-right">
                {timestamp}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssistantMessage({
  message,
  isLoading = false,
  onSaveChart,
  followUpComposeRef,
  followUpExternalError,
  onDismissFollowUpExternalError,
}) {
  const statusEvents = React.useMemo(
    () => message.statusEvents || [],
    [message.statusEvents]
  );
  const toolCallEvents = React.useMemo(
    () => statusEvents.filter((e) => e.type === 'tool_call'),
    [statusEvents]
  );
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const thought = message.thought || '';
  const hasResponse = !!message.content;
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(!hasResponse);

  // Safely format timestamp for assistant messages
  const assistantTimestamp = React.useMemo(
    () => {
      const rawTimestamp =
        message?.timestamp ?? message?.created_at ?? message?.time ?? null;
      return formatTimeFromTimestamp(rawTimestamp, message?.isHistory);
    },
    [message?.timestamp, message?.created_at, message?.time, message?.isHistory]
  );

  // Automatically collapse thought once a response starts streaming
  useEffect(() => {
    if (hasResponse) {
      setIsThoughtExpanded(false);
    }
  }, [hasResponse]);

  const parseNestedJson = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      const trimmed = obj.trim();
      if (!trimmed) return obj;
      try {
        return parseNestedJson(JSON.parse(trimmed));
      } catch (e) {
        return obj;
      }
    }
    if (Array.isArray(obj)) return obj.map(parseNestedJson);
    if (typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = parseNestedJson(v);
      }
      return out;
    }
    return obj;
  };

  const formatToolCallArguments = (value) => {
    if (value === null || value === undefined) return null;
    const raw = typeof value === 'string' ? (value.trim() ? (() => { try { return JSON.parse(value); } catch (e) { return null; } })() : null) : value;
    if (raw === null || raw === undefined) return null;
    const parsed = parseNestedJson(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0) return null;
    try {
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return null;
    }
  };

  const getToolCallDetails = (event) => {
    const toolName =
      (typeof event.toolName === 'string' && event.toolName.trim()) ||
      'Unknown tool';
    const argsPretty = formatToolCallArguments(event.arguments);
    return {
      toolName,
      argsPretty,
    };
  };

  const latestToolCall = React.useMemo(
    () => toolCallEvents[toolCallEvents.length - 1],
    [toolCallEvents]
  );

  const extractVisualization = (content) => {
    if (!content || typeof content !== 'object') return null;
    return content.visualization || null;
  };

  const visualization = React.useMemo(() => {
    if (message.visualization) return message.visualization;
    for (let i = statusEvents.length - 1; i >= 0; i -= 1) {
      const event = statusEvents[i];
      if (event?.type !== 'tool_output') continue;
      const viz = extractVisualization(event.content);
      if (viz) return viz;
    }
    return null;
  }, [message.visualization, statusEvents]);

  const getStatusIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const toolCallRowClass =
    'text-green-400 bg-green-500/10 border-green-500/20';

  const followUpSteps = message.followUpOptions;
  const showFollowUpReadOnly =
    Array.isArray(followUpSteps) &&
    followUpSteps.length > 0 &&
    message.followUpOptionsReadOnly;
  const showFollowUp =
    Array.isArray(followUpSteps) &&
    followUpSteps.length > 0 &&
    !message.followUpResolved &&
    !message.followUpOptionsReadOnly &&
    !isLoading &&
    followUpComposeRef != null;

  return (
    <div className="flex justify-start mb-4 animate-fade-in chat-font">
      <div className="flex items-start space-x-3 w-[70%]">
        <img src="/bull.png" alt="bullAI" className="flex-shrink-0 w-8 h-8 rounded-full object-contain p-1" />
        <div className="flex-1 flex flex-col">
          <div className="text-gray-100">
            {isLoading && !message.content ? (
              <div className="space-y-2">
                {visualization && (
                  <div className="mb-4">
                    <VizChart
                      visualization={visualization}
                      onSave={onSaveChart}
                    />
                  </div>
                )}
                {thought && (
                  <div className="mt-2 text-xs text-gray-400 whitespace-normal break-words text-left">
                    <button
                      type="button"
                      onClick={() => hasResponse && setIsThoughtExpanded(prev => !prev)}
                      className="flex items-center gap-1 mb-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer disabled:cursor-default"
                      disabled={!hasResponse}
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${!hasResponse || isThoughtExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="font-semibold">Thought</span>
                    </button>
                    {(!hasResponse || isThoughtExpanded) && <p>{thought}</p>}
                  </div>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">Thinking</span>
                </div>
                {latestToolCall && (() => {
                  const details = getToolCallDetails(latestToolCall);
                  return (
                    <div className="mt-3">
                      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs w-fit max-w-full ${toolCallRowClass} animate-fade-in`}>
                        {getStatusIcon()}
                        <div className="flex flex-col text-left min-w-0 max-w-full">
                          <span className="text-gray-200">Tool called: {details.toolName}</span>
                          {details.argsPretty && (
                            <pre className="mt-1 max-h-48 max-w-full overflow-auto text-xs font-mono whitespace-pre-wrap break-words text-gray-300 border-t border-green-500/20 pt-1">
                              <code className="text-gray-300">{details.argsPretty}</code>
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                {visualization && (
                  <div className="mb-4">
                    <VizChart
                      visualization={visualization}
                      onSave={onSaveChart}
                    />
                  </div>
                )}
                {thought && (
                  <div className="mt-2 mb-2 text-xs text-gray-400 whitespace-normal break-words text-left">
                    <button
                      type="button"
                      onClick={() => hasResponse && setIsThoughtExpanded(prev => !prev)}
                      className="flex items-center gap-1 mb-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer disabled:cursor-default"
                      disabled={!hasResponse}
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${!hasResponse || isThoughtExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="font-semibold">Thought</span>
                    </button>
                    {(!hasResponse || isThoughtExpanded) && <p>{thought}</p>}
                  </div>
                )}
                <div className="text-sm leading-normal w-[100%] text-left [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Headings
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2 text-white" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-3 mb-2 text-white" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-white" {...props} />,
                      h4: ({ node, ...props }) => <h4 className="text-base font-semibold mt-2 mb-1 text-white" {...props} />,
                      h5: ({ node, ...props }) => <h5 className="text-sm font-semibold mt-2 mb-1 text-white" {...props} />,
                      h6: ({ node, ...props }) => <h6 className="text-sm font-medium mt-2 mb-1 text-gray-300" {...props} />,
                      // Paragraphs
                      p: ({ node, ...props }) => <p className="mb-1 text-gray-100" {...props} />,
                      // Lists
                      ul: ({ node, ...props }) => <ul className="list-disc list-outside mb-3 space-y-1 text-gray-100 pl-5" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-outside mb-3 space-y-1 text-gray-100 pl-5" {...props} />,
                      li: ({ node, ...props }) => <li className="text-gray-100" {...props} />,
                      // Code blocks
                      code: ({ node, inline, className, children, ...props }) => {
                        if (inline) {
                          return (
                            <code className="bg-gray-800 text-green-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code className={`${className || ''} font-mono`} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ node, children, ...props }) => {
                        return (
                          <pre className="bg-gray-900 rounded-lg p-4 my-3 overflow-x-auto text-sm text-gray-100 border border-gray-700 whitespace-pre-wrap" {...props}>
                            {children}
                          </pre>
                        );
                      },
                      // Links
                      a: ({ node, ...props }) => <a className="text-green-400 hover:text-green-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                      // Blockquotes
                      blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-600 pl-4 my-3 italic text-gray-300" {...props} />,
                      // Horizontal rule
                      hr: ({ node, ...props }) => <hr className="my-4 border-gray-700" {...props} />,
                      // Tables
                      table: ({ node, ...props }) => <table className="border-collapse border border-gray-700 my-3 w-full" {...props} />,
                      thead: ({ node, ...props }) => <thead className="bg-gray-800" {...props} />,
                      tbody: ({ node, ...props }) => <tbody {...props} />,
                      tr: ({ node, ...props }) => <tr className="border-b border-gray-700" {...props} />,
                      th: ({ node, ...props }) => <th className="border border-gray-700 px-3 py-2 text-left font-semibold text-white" {...props} />,
                      td: ({ node, ...props }) => <td className="border border-gray-700 px-3 py-2 text-gray-100" {...props} />,
                      // Strong and emphasis
                      strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                      em: ({ node, ...props }) => <em className="italic" {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                {latestToolCall && isLoading && (() => {
                  const details = getToolCallDetails(latestToolCall);
                  return (
                    <div className="mt-3">
                      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs w-fit max-w-full ${toolCallRowClass} animate-fade-in`}>
                        {getStatusIcon()}
                        <div className="flex flex-col text-left min-w-0 max-w-full">
                          <span className="text-gray-200">Tool called: {details.toolName}</span>
                          {details.argsPretty && (
                            <pre className="mt-1 max-h-48 max-w-full overflow-auto text-xs font-mono whitespace-pre-wrap break-words text-gray-300 border-t border-green-500/20 pt-1">
                              <code className="text-gray-300">{details.argsPretty}</code>
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          {showFollowUpReadOnly && (
            <FollowUpOptionsReadOnlyRecap steps={followUpSteps} />
          )}
          {showFollowUp && (
            <FollowUpOptionsForm
              ref={followUpComposeRef}
              messageId={message.id}
              steps={followUpSteps}
              externalError={followUpExternalError}
              onDismissExternalError={onDismissFollowUpExternalError}
            />
          )}
          {message.content && assistantTimestamp && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">
                {assistantTimestamp}
              </span>
              {toolCallEvents.length > 0 && (
                <button
                  onClick={() => setIsStatusExpanded(!isStatusExpanded)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title={isStatusExpanded ? 'Hide tool calls' : 'Show tool calls'}
                >
                  <svg 
                    className={`w-3 h-3 transition-transform ${isStatusExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>
                    {toolCallEvents.length} {toolCallEvents.length === 1 ? 'tool' : 'tools'}
                  </span>
                </button>
              )}
            </div>
          )}
          {isStatusExpanded && toolCallEvents.length > 0 && message.content && (
            <div className="mt-2 space-y-1.5 animate-fade-in flex flex-col items-start">
              {toolCallEvents.map((event, index) => {
                const details = getToolCallDetails(event);
                return (
                  <div
                    key={`${details.toolName}-${index}`}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs w-full max-w-full ${toolCallRowClass}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon()}
                    </div>
                    <div className="flex flex-col text-left min-w-0 flex-1">
                      <span className="text-gray-200">Tool called: {details.toolName}</span>
                      {details.argsPretty && (
                        <pre className="mt-1 max-h-48 max-w-full overflow-x-auto overflow-y-auto text-xs font-mono whitespace-pre-wrap break-words text-gray-300 border-t border-green-500/20 pt-1">
                          <code className="text-gray-300">{details.argsPretty}</code>
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SystemMessage({ message }) {
  return (
    <div className="flex justify-center mb-4">
      <div className="bg-surface-elevated/50 text-gray-400 rounded-full px-4 py-2 text-xs border border-divider">
        {message.content}
      </div>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex justify-center mb-4">
      <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-lg px-4 py-3 max-w-md">
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm">{message.content}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-xs text-red-300 hover:text-red-200 underline cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

