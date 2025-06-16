import React, { useState, useEffect } from 'react';
import { Search, Plus, TrendingUp, TrendingDown, X, Globe, MapPin, Edit2, Trash2, FolderPlus, Save, MoreVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { Symbol, Watchlist, WatchlistData } from '../types/trading';
import { fetchSymbolData, searchSymbols, POPULAR_SYMBOLS } from '../services/yahooFinance';

interface WatchlistManagerProps {
  selectedSymbol: string;
  onSymbolSelect: (symbol: string) => void;
  watchlists: Watchlist[];
  onWatchlistsUpdate: (watchlists: Watchlist[]) => void;
}

interface WatchlistSection {
  id: string;
  name: string;
  symbols: string[];
  expanded: boolean;
}

export function WatchlistManager({ selectedSymbol, onSymbolSelect, watchlists, onWatchlistsUpdate }: WatchlistManagerProps) {
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Symbol[]>([]);
  const [watchlistsData, setWatchlistsData] = useState<WatchlistData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showPopular, setShowPopular] = useState(false);
  const [showCreateWatchlist, setShowCreateWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [editingWatchlist, setEditingWatchlist] = useState<string | null>(null);
  const [editWatchlistName, setEditWatchlistName] = useState('');
  const [showWatchlistMenu, setShowWatchlistMenu] = useState<string | null>(null);
  const [sections, setSections] = useState<WatchlistSection[]>([]);

  // Initialize with default watchlist if none exist
  useEffect(() => {
    if (watchlists.length === 0) {
      const defaultWatchlist: Watchlist = {
        id: 'default',
        name: 'My Watchlist',
        symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'RELIANCE.NS', 'TCS.NS'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      onWatchlistsUpdate([defaultWatchlist]);
      setActiveWatchlistId('default');
    } else if (!activeWatchlistId && watchlists.length > 0) {
      setActiveWatchlistId(watchlists[0].id);
    }
  }, [watchlists, activeWatchlistId, onWatchlistsUpdate]);

  // Initialize sections for active watchlist
  useEffect(() => {
    const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId);
    if (activeWatchlist) {
      // Create default sections based on symbol types
      const defaultSections: WatchlistSection[] = [
        {
          id: 'us-stocks',
          name: 'US Stocks',
          symbols: activeWatchlist.symbols.filter(s => !s.includes('.NS') && !s.includes('.BO') && !s.includes('-USD')),
          expanded: true
        },
        {
          id: 'indian-stocks',
          name: 'Indian Stocks',
          symbols: activeWatchlist.symbols.filter(s => s.includes('.NS') || s.includes('.BO')),
          expanded: true
        },
        {
          id: 'crypto',
          name: 'Cryptocurrency',
          symbols: activeWatchlist.symbols.filter(s => s.includes('-USD')),
          expanded: true
        }
      ].filter(section => section.symbols.length > 0);

      setSections(defaultSections);
    }
  }, [activeWatchlistId, watchlists]);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId);
  const activeWatchlistData = watchlistsData.find(wd => wd.watchlist.id === activeWatchlistId);

  // Fetch watchlist data
  useEffect(() => {
    const fetchWatchlistsData = async () => {
      if (watchlists.length === 0) return;
      
      setLoading(true);
      const promises = watchlists.map(async (watchlist) => {
        const symbolPromises = watchlist.symbols.map(symbol => fetchSymbolData(symbol));
        const symbolResults = await Promise.all(symbolPromises);
        const validResults = symbolResults.filter((result): result is Symbol => result !== null);
        return { watchlist, symbolData: validResults };
      });
      
      const results = await Promise.all(promises);
      setWatchlistsData(results);
      setLoading(false);
    };

    fetchWatchlistsData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchWatchlistsData, 30000);
    return () => clearInterval(interval);
  }, [watchlists]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 1) {
      setSearchLoading(true);
      try {
        const results = await searchSymbols(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
      setSearchLoading(false);
    } else {
      setSearchResults([]);
    }
  };

  const createWatchlist = () => {
    if (!newWatchlistName.trim()) return;
    
    const newWatchlist: Watchlist = {
      id: Date.now().toString(),
      name: newWatchlistName.trim(),
      symbols: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    onWatchlistsUpdate([...watchlists, newWatchlist]);
    setActiveWatchlistId(newWatchlist.id);
    setNewWatchlistName('');
    setShowCreateWatchlist(false);
  };

  const updateWatchlistName = (watchlistId: string, newName: string) => {
    if (!newName.trim()) return;
    
    const updatedWatchlists = watchlists.map(w => 
      w.id === watchlistId 
        ? { ...w, name: newName.trim(), updatedAt: Date.now() }
        : w
    );
    onWatchlistsUpdate(updatedWatchlists);
    setEditingWatchlist(null);
    setEditWatchlistName('');
  };

  const deleteWatchlist = (watchlistId: string) => {
    if (watchlists.length <= 1) return;
    
    const updatedWatchlists = watchlists.filter(w => w.id !== watchlistId);
    onWatchlistsUpdate(updatedWatchlists);
    
    if (activeWatchlistId === watchlistId) {
      setActiveWatchlistId(updatedWatchlists[0]?.id || '');
    }
    setShowWatchlistMenu(null);
  };

  const addToWatchlist = async (symbol: string) => {
    if (!activeWatchlist || activeWatchlist.symbols.includes(symbol)) return;
    if (activeWatchlist.symbols.length >= 250) {
      alert('Watchlist is full (250 symbols maximum)');
      return;
    }

    const updatedWatchlists = watchlists.map(w => 
      w.id === activeWatchlistId 
        ? { ...w, symbols: [...w.symbols, symbol], updatedAt: Date.now() }
        : w
    );
    onWatchlistsUpdate(updatedWatchlists);
    
    setShowSearch(false);
    setShowPopular(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeFromWatchlist = (symbol: string) => {
    if (!activeWatchlist) return;
    
    const updatedWatchlists = watchlists.map(w => 
      w.id === activeWatchlistId 
        ? { ...w, symbols: w.symbols.filter(s => s !== symbol), updatedAt: Date.now() }
        : w
    );
    onWatchlistsUpdate(updatedWatchlists);
  };

  const addPopularSymbol = (symbol: string) => {
    addToWatchlist(symbol);
  };

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  const renderSymbolItem = (symbol: Symbol) => {
    const changePercent = isNaN(symbol.changePercent) ? 0 : symbol.changePercent;
    
    return (
      <div
        key={symbol.symbol}
        className={`group p-2 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${
          selectedSymbol === symbol.symbol ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
        }`}
        onClick={() => onSymbolSelect(symbol.symbol)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-900 text-sm truncate">{symbol.symbol}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromWatchlist(symbol.symbol);
                }}
                className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-gray-300"
              >
                <X className="w-2 h-2 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-gray-900">${symbol.price.toFixed(2)}</span>
              <div className={`text-xs font-medium ${
                changePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border-l-2 border-gray-300 w-72 flex flex-col flex-shrink-0">
      {/* Compact Watchlist Header */}
      <div className="p-3 border-b-2 border-gray-300 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Watchlists</h2>
          <button
            onClick={() => setShowCreateWatchlist(true)}
            className="p-1 hover:bg-gray-200 rounded transition-colors border border-gray-300"
            title="Create new watchlist"
          >
            <FolderPlus className="w-3 h-3 text-gray-600" />
          </button>
        </div>

        {/* Compact Watchlist Tabs */}
        <div className="flex flex-wrap gap-1 mb-2">
          {watchlists.map((watchlist) => (
            <div key={watchlist.id} className="relative group">
              <button
                onClick={() => setActiveWatchlistId(watchlist.id)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center space-x-1 border ${
                  activeWatchlistId === watchlist.id
                    ? 'bg-blue-500 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="truncate max-w-16">{watchlist.name}</span>
                <span className="text-xs opacity-75">({watchlist.symbols.length})</span>
              </button>
              
              {watchlists.length > 1 && (
                <button
                  onClick={() => setShowWatchlistMenu(showWatchlistMenu === watchlist.id ? null : watchlist.id)}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-gray-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <MoreVertical className="w-2 h-2" />
                </button>
              )}

              {showWatchlistMenu === watchlist.id && (
                <div className="absolute top-full right-0 mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg z-20 min-w-28">
                  <button
                    onClick={() => {
                      setEditingWatchlist(watchlist.id);
                      setEditWatchlistName(watchlist.name);
                      setShowWatchlistMenu(null);
                    }}
                    className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 flex items-center space-x-1 text-gray-700"
                  >
                    <Edit2 className="w-2 h-2" />
                    <span>Rename</span>
                  </button>
                  {watchlists.length > 1 && (
                    <button
                      onClick={() => deleteWatchlist(watchlist.id)}
                      className="w-full px-2 py-1 text-left text-xs hover:bg-gray-100 text-red-600 flex items-center space-x-1"
                    >
                      <Trash2 className="w-2 h-2" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create/Edit Forms */}
        {showCreateWatchlist && (
          <div className="mb-2 p-2 bg-white rounded border border-gray-300">
            <div className="flex space-x-1">
              <input
                type="text"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="Name"
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && createWatchlist()}
              />
              <button onClick={createWatchlist} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 border border-blue-600">
                <Save className="w-3 h-3" />
              </button>
              <button onClick={() => setShowCreateWatchlist(false)} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 border border-gray-300">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {editingWatchlist && (
          <div className="mb-2 p-2 bg-white rounded border border-gray-300">
            <div className="flex space-x-1">
              <input
                type="text"
                value={editWatchlistName}
                onChange={(e) => setEditWatchlistName(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && updateWatchlistName(editingWatchlist, editWatchlistName)}
              />
              <button onClick={() => updateWatchlistName(editingWatchlist, editWatchlistName)} className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 border border-blue-600">
                <Save className="w-3 h-3" />
              </button>
              <button onClick={() => { setEditingWatchlist(null); setEditWatchlistName(''); }} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 border border-gray-300">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Compact Controls */}
        {activeWatchlist && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {activeWatchlist.symbols.length}/250
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  setShowPopular(!showPopular);
                  setShowSearch(false);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors border border-gray-300"
                title="Popular symbols"
              >
                <Globe className="w-3 h-3 text-gray-600" />
              </button>
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  setShowPopular(false);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors border border-gray-300"
              >
                {showSearch ? <X className="w-3 h-3 text-gray-600" /> : <Plus className="w-3 h-3 text-gray-600" />}
              </button>
            </div>
          </div>
        )}

        {/* Compact Popular Symbols */}
        {showPopular && (
          <div className="mt-2 p-2 bg-white rounded text-xs border border-gray-300">
            <div className="space-y-1">
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <Globe className="w-2 h-2 text-blue-500" />
                  <span className="font-medium text-gray-700">US</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {POPULAR_SYMBOLS.US.slice(0, 6).map(symbol => (
                    <button
                      key={symbol}
                      onClick={() => addPopularSymbol(symbol)}
                      disabled={activeWatchlist?.symbols.includes(symbol)}
                      className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50 text-xs border border-blue-200"
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <MapPin className="w-2 h-2 text-orange-500" />
                  <span className="font-medium text-gray-700">IN</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {POPULAR_SYMBOLS.INDIAN.slice(0, 6).map(symbol => (
                    <button
                      key={symbol}
                      onClick={() => addPopularSymbol(symbol)}
                      disabled={activeWatchlist?.symbols.includes(symbol)}
                      className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors disabled:opacity-50 text-xs border border-orange-200"
                    >
                      {symbol.replace('.NS', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Search */}
        {showSearch && (
          <div className="mt-2 relative">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 w-3 h-3" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-6 pr-3 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            
            {searchLoading && (
              <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-300 rounded shadow-lg mt-1 p-2 z-10">
                <div className="text-center text-gray-600 text-xs">Searching...</div>
              </div>
            )}
            
            {searchResults.length > 0 && !searchLoading && (
              <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-300 rounded shadow-lg mt-1 max-h-32 overflow-y-auto z-10">
                {searchResults.map((symbol) => (
                  <button
                    key={symbol.symbol}
                    onClick={() => addToWatchlist(symbol.symbol)}
                    disabled={activeWatchlist?.symbols.includes(symbol.symbol)}
                    className="w-full px-2 py-1 hover:bg-gray-100 flex items-center justify-between text-left disabled:opacity-50 text-xs"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{symbol.symbol}</div>
                      <div className="text-gray-600 truncate">{symbol.name}</div>
                    </div>
                    <Plus className="w-3 h-3 text-gray-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compact Watchlist Content with Sections */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading && (!activeWatchlistData || activeWatchlistData.symbolData.length === 0) ? (
          <div className="p-3 text-center text-gray-600 text-xs">Loading...</div>
        ) : !activeWatchlist || activeWatchlist.symbols.length === 0 ? (
          <div className="p-3 text-center text-gray-600 text-xs">
            <div className="mb-1">Empty watchlist</div>
            <div className="text-xs">Click + to add symbols</div>
          </div>
        ) : (
          sections.map((section) => {
            const sectionSymbols = activeWatchlistData?.symbolData.filter(symbol => 
              section.symbols.includes(symbol.symbol)
            ) || [];

            if (sectionSymbols.length === 0) return null;

            return (
              <div key={section.id} className="border-b border-gray-200">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 flex items-center justify-between text-left border-b border-gray-200"
                >
                  <span className="text-xs font-medium text-gray-700">{section.name}</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">({sectionSymbols.length})</span>
                    {section.expanded ? (
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                </button>
                
                {section.expanded && (
                  <div>
                    {sectionSymbols.map(renderSymbolItem)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t-2 border-gray-300 bg-gray-50">
        <div className="text-xs text-gray-600 text-center">
          Auto-refresh: 30s
        </div>
      </div>
    </div>
  );
}