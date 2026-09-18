import React from 'react';
import ChatUI from './ChatUI';
import ComparisonPage from './components/ComparisonPage';

const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const comparisonId = params.get('comparison');

  if (comparisonId) {
    const id = Number(comparisonId);
    if (!Number.isNaN(id) && id > 0) {
      return <ComparisonPage documentId={id} />;
    }
  }

  return <ChatUI />;
};

export default App;