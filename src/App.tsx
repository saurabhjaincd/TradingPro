import React, { useState, useEffect } from 'react';
import { WatchlistManager } from './components/WatchlistManager';
import { SingleChart } from './components/SingleChart';
import { MultiChart } from './components/MultiChart';
import { BarChart3, Grid3X3 } from 'lucide-react';
import { Watchlist } from './types/trading';

type ViewMode = 'single' | 'multi';

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('single');

  // Load watchlists from localStorage on mount
  useEffect(() => {
    const savedWatchlists = localStorage.getItem('tradingWatchlists');
    if (savedWatchlists) {
      try {
        const parsed = JSON.parse(savedWatchlists);
        setWatchlists(parsed);
      } catch (error) {
        console.error('Error loading watchlists:', error);
      }
    }
  }, []);

  // Save watchlists to localStorage whenever they change
  useEffect(() => {
    if (watchlists.length > 0) {
      localStorage.setItem('tradingWatchlists', JSON.stringify(watchlists));
    }
  }, [watchlists]);

  return (
    <div className="h-screen bg-white flex">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {viewMode === 'single' ? (
          <SingleChart 
            symbol={selectedSymbol} 
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        ) : (
          <MultiChart 
            symbol={selectedSymbol} 
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}
      </div>
      
      <WatchlistManager
        selectedSymbol={selectedSymbol}
        onSymbolSelect={setSelectedSymbol}
        watchlists={watchlists}
        onWatchlistsUpdate={setWatchlists}
      />
    </div>
  );
}

export default App;