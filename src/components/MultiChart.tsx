import React, { useState, useEffect } from 'react';
import { Chart } from './Chart';
import { Timeframe, ChartData } from '../types/trading';
import { fetchChartData } from '../services/yahooFinance';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface MultiChartProps {
  symbol: string;
  viewMode: 'single' | 'multi';
  onViewModeChange: (mode: 'single' | 'multi') => void;
}

const AVAILABLE_TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1D', value: '1d' },
  { label: '2D', value: '2d' },
  { label: '3D', value: '3d' },
  { label: '4D', value: '4d' },
  { label: '1W', value: '1w' },
  { label: '6D', value: '6d' },
  { label: '7D', value: '7d' },
  { label: '2W', value: '2w' },
  { label: '3W', value: '3w' },
  { label: '1M', value: '1M' },
  { label: '5W', value: '5w' },
  { label: '6W', value: '6w' },
  { label: '2M', value: '2M' },
  { label: '3M', value: '3M' }
];

export function MultiChart({ symbol, viewMode, onViewModeChange }: MultiChartProps) {
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1d');
  const [chartData, setChartData] = useState<Record<string, ChartData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Only show 4 charts at a time
  const chartsToShow = 4;
  const currentTimeframes = AVAILABLE_TIMEFRAMES.slice(currentChartIndex, currentChartIndex + chartsToShow);

  useEffect(() => {
    fetchAllChartData();
  }, [symbol, currentChartIndex]);

  const fetchAllChartData = async () => {
    const promises = currentTimeframes.map(async (tf, index) => {
      const key = `${tf.value}-${currentChartIndex + index}`;
      setLoading(prev => ({ ...prev, [key]: true }));

      try {
        const data = await fetchChartData(symbol, tf.value);
        if (data) {
          setChartData(prev => ({ ...prev, [key]: data }));
        }
      } catch (error) {
        console.error(`Error fetching data for ${tf.value}:`, error);
      }
      
      setLoading(prev => ({ ...prev, [key]: false }));
    });

    await Promise.all(promises);
  };

  const handlePrevCharts = () => {
    setCurrentChartIndex(prev => Math.max(0, prev - chartsToShow));
  };

  const handleNextCharts = () => {
    setCurrentChartIndex(prev => Math.min(AVAILABLE_TIMEFRAMES.length - chartsToShow, prev + chartsToShow));
  };

  const refreshData = () => {
    fetchAllChartData();
  };

  return (
    <div className="h-full flex flex-col bg-white border-r-2 border-gray-300">
      {/* Header */}
      <div className="p-3 border-b-2 border-gray-300 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Multi-Timeframe Analysis</h2>
            <p className="text-sm text-gray-600">Compare {symbol} across timeframes</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Compact View Mode Toggle */}
            <div className="flex bg-gray-100 rounded p-0.5 border border-gray-300">
              <button
                onClick={() => onViewModeChange('single')}
                className={`px-2 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'single'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Single Chart View"
              >
                S
              </button>
              <button
                onClick={() => onViewModeChange('multi')}
                className={`px-2 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'multi'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Multi Chart View"
              >
                M
              </button>
            </div>

            <button
              onClick={refreshData}
              className="p-2 hover:bg-gray-100 rounded transition-colors border border-gray-300"
              title="Refresh charts"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Chart Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrevCharts}
              disabled={currentChartIndex === 0}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                Charts {currentChartIndex + 1}-{Math.min(currentChartIndex + chartsToShow, AVAILABLE_TIMEFRAMES.length)}
              </div>
              <div className="text-sm text-gray-600">
                of {AVAILABLE_TIMEFRAMES.length} timeframes
              </div>
            </div>
            
            <button
              onClick={handleNextCharts}
              disabled={currentChartIndex + chartsToShow >= AVAILABLE_TIMEFRAMES.length}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Timeframe Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Timeframe:</span>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {AVAILABLE_TIMEFRAMES.map(tf => (
                <option key={tf.value} value={tf.value}>{tf.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Charts Grid - 2x2 layout */}
      <div className="flex-1 p-3 min-h-0 bg-gray-50">
        <div className="grid grid-cols-2 gap-3 h-full">
          {currentTimeframes.map((timeframe, index) => {
            const key = `${timeframe.value}-${currentChartIndex + index}`;
            const isLoading = loading[key];
            const data = chartData[key];

            return (
              <div key={key} className="bg-white rounded-lg border border-gray-300 shadow-sm">
                <div className="p-2 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-900">{timeframe.label}</h3>
                    {isLoading && (
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                    )}
                  </div>
                </div>
                
                <div className="p-2 h-full">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-1" />
                        <div className="text-xs text-gray-600">Loading...</div>
                      </div>
                    </div>
                  ) : data ? (
                    <div className="h-full">
                      <Chart
                        symbol={symbol}
                        timeframe={timeframe.value}
                        candles={data.candles}
                        rsi={data.rsi}
                        showRSI={true}
                      />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-500 text-xs">
                        <div>No data available</div>
                        <button
                          onClick={fetchAllChartData}
                          className="mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}