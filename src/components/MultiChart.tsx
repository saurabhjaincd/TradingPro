import React, { useState, useEffect } from 'react';
import { Chart } from './Chart';
import { TimeframeSelector } from './TimeframeSelector';
import { Timeframe, ChartData } from '../types/trading';
import { fetchChartData, fetchSymbolData } from '../services/yahooFinance';
import { RefreshCw, ChevronLeft, ChevronRight, BarChart3, Grid3X3 } from 'lucide-react';

interface MultiChartProps {
  symbol: string;
  viewMode: 'single' | 'multi';
  onViewModeChange: (mode: 'single' | 'multi') => void;
}

const AVAILABLE_TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1H', value: '1h' },
  { label: '2H', value: '2h' },
  { label: '3H', value: '3h' },
  { label: '4H', value: '4h' },
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
  const [currentTimeframeIndex, setCurrentTimeframeIndex] = useState(0);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [symbolData, setSymbolData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTimeframe = AVAILABLE_TIMEFRAMES[currentTimeframeIndex];

  useEffect(() => {
    fetchData();
  }, [symbol, currentTimeframeIndex]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [chartResult, symbolResult] = await Promise.all([
        fetchChartData(symbol, currentTimeframe.value),
        fetchSymbolData(symbol)
      ]);
      
      if (chartResult) {
        setChartData(chartResult);
      } else {
        setError('Unable to fetch chart data. Please check the symbol and try again.');
      }
      
      if (symbolResult) {
        setSymbolData(symbolResult);
      }
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error('Error fetching data:', err);
    }
    
    setLoading(false);
  };

  const handlePrevTimeframe = () => {
    setCurrentTimeframeIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextTimeframe = () => {
    setCurrentTimeframeIndex(prev => Math.min(AVAILABLE_TIMEFRAMES.length - 1, prev + 1));
  };

  const currentPrice = symbolData?.price || (chartData?.candles[chartData.candles.length - 1]?.close) || 0;
  const previousPrice = chartData?.candles[chartData.candles.length - 2]?.close || 0;
  const priceChange = symbolData?.change || (currentPrice - previousPrice);
  const priceChangePercent = symbolData?.changePercent || ((priceChange / previousPrice) * 100);

  if (loading && !chartData) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      </div>
    );
  }

  if (error && !chartData) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-red-400 mb-2">{error}</div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border-r-2 border-gray-300">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-gray-300 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold text-gray-900">{symbol}</h2>
              {loading && (
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-2xl font-bold text-gray-900">${currentPrice.toFixed(2)}</span>
              <div className={`flex items-center space-x-1 text-sm font-medium ${
                priceChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-300">
              <button
                onClick={() => onViewModeChange('single')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center ${
                  viewMode === 'single'
                    ? 'bg-white text-gray-900 shadow-md border border-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Single Chart View"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('multi')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center ${
                  viewMode === 'multi'
                    ? 'bg-white text-gray-900 shadow-md border border-gray-200'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Multi Chart View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={fetchData}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
              title="Refresh chart"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Timeframe Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrevTimeframe}
              disabled={currentTimeframeIndex === 0}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="text-center min-w-32">
              <div className="text-xl font-bold text-gray-900">
                {currentTimeframe.label}
              </div>
              <div className="text-sm text-gray-600">
                {currentTimeframeIndex + 1} of {AVAILABLE_TIMEFRAMES.length}
              </div>
            </div>
            
            <button
              onClick={handleNextTimeframe}
              disabled={currentTimeframeIndex >= AVAILABLE_TIMEFRAMES.length - 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Timeframe Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Quick Select:</span>
            <div className="flex space-x-1">
              {[0, 4, 8, 13].map((index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTimeframeIndex(index)}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    currentTimeframeIndex === index
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {AVAILABLE_TIMEFRAMES[index].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Chart Container - Full height */}
      <div className="flex-1 p-4 min-h-0 bg-gray-50">
        {chartData ? (
          <Chart
            symbol={symbol}
            timeframe={currentTimeframe.value}
            candles={chartData.candles}
            rsi={chartData.rsi}
            showRSI={true}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 bg-white rounded-lg border-2 border-gray-300">
            No chart data available
          </div>
        )}
      </div>
    </div>
  );
}