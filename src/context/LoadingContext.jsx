import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { LoadingPage } from '../components/LoadingPage.jsx';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    message: 'Loading...',
    submessage: 'Please wait while SMART WASH prepares your experience...',
    progress: null,
    showDiagnostics: false,
    allowSkip: false
  });

  const showLoading = useCallback((
    message = 'Loading...',
    submessage = 'Please wait while SMART WASH prepares your experience...',
    options = {}
  ) => {
    setLoadingState({
      isLoading: true,
      message,
      submessage,
      progress: options.progress !== undefined ? options.progress : null,
      showDiagnostics: options.showDiagnostics || false,
      allowSkip: options.allowSkip || false,
      onComplete: options.onComplete || null
    });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: false
    }));
  }, []);

  const updateProgress = useCallback((progress) => {
    setLoadingState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress))
    }));
  }, []);

  const contextValue = useMemo(() => ({
    isLoading: loadingState.isLoading,
    loadingMessage: loadingState.message,
    loadingSubmessage: loadingState.submessage,
    progress: loadingState.progress,
    showLoading,
    hideLoading,
    updateProgress
  }), [loadingState, showLoading, hideLoading, updateProgress]);

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
      {loadingState.isLoading && (
        <LoadingPage
          message={loadingState.message}
          submessage={loadingState.submessage}
          progress={loadingState.progress}
          showDiagnostics={loadingState.showDiagnostics}
          allowSkip={loadingState.allowSkip}
          onComplete={() => {
            if (loadingState.onComplete) {
              loadingState.onComplete();
            } else {
              hideLoading();
            }
          }}
        />
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    // Graceful fallback if called outside provider
    return {
      isLoading: false,
      loadingMessage: '',
      loadingSubmessage: '',
      progress: null,
      showLoading: () => {},
      hideLoading: () => {},
      updateProgress: () => {}
    };
  }
  return ctx;
}

export default LoadingContext;
