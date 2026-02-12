import React, { useState, useRef } from "react";
import SideNav from "./components/SideNav";
import ChatInterface from "./components/ChatInterface";
import Settings from "./components/Settings";
import TimeSeriesDashboard from "./components/TimeSeriesDashboard";

export default function App() {
  const [isSideNavOpen, setIsSideNavOpen] = useState(true);
  const [chatKey, setChatKey] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeView, setActiveView] = useState('chat');
  const refetchSessionsRef = useRef(null);

  const handleNewChat = () => {
    setSelectedSessionId(null);
    setChatKey(prev => prev + 1);
    setActiveView('chat');
  };

  const handleSelectChat = (sessionId) => {
    setSelectedSessionId(sessionId);
    setChatKey(prev => prev + 1);
    setActiveView('chat');
  };

  const handleRefetchReady = (refetchFn) => {
    refetchSessionsRef.current = refetchFn;
  };

  return (
    <div className="flex flex-row w-screen h-screen min-h-screen">
      <SideNav 
        isOpen={isSideNavOpen} 
        onToggle={() => setIsSideNavOpen(!isSideNavOpen)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onOpenSettings={() => setActiveView('settings')}
        onCloseSettings={() => setActiveView('chat')}
        onOpenCharts={() => setActiveView('charts')}
        onRefetchReady={handleRefetchReady}
        selectedSessionId={selectedSessionId}
        onChatDeleted={(sessionId) => {
          if (sessionId === selectedSessionId) {
            handleNewChat();
          }
        }}
      />
      <div className="h-full w-full flex flex-col bg-surface overflow-hidden relative">
        <div className="flex-1 min-h-0 flex flex-col bg-surface overflow-hidden">
          {activeView === 'settings' ? (
            <Settings onClose={() => setActiveView('chat')} />
          ) : activeView === 'charts' ? (
            <TimeSeriesDashboard />
          ) : (
            <ChatInterface 
              key={chatKey}
              initialSessionId={selectedSessionId}
              isSideNavOpen={isSideNavOpen}
              onToggleSideNav={() => setIsSideNavOpen(!isSideNavOpen)}
              onSessionUpdate={() => {
                if (refetchSessionsRef.current) {
                  refetchSessionsRef.current();
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

