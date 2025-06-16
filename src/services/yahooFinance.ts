import axios from 'axios';
import { Symbol, Candle, ChartData, RSIData, Timeframe } from '../types/trading';

// Yahoo Finance API endpoints
const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_BASE = 'https://query2.finance.yahoo.com/v1/finance/search';

// CORS proxy for development (you may need to replace this with your own proxy in production)
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

interface YahooQuoteResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        previousClose: number;
        currency: string;
        exchangeName: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }>;
  };
}

interface YahooSearchResponse {
  quotes: Array<{
    symbol: string;
    shortname: string;
    longname: string;
    exchDisp: string;
    typeDisp: string;
  }>;
}

// Convert timeframe to Yahoo Finance interval and determine if custom aggregation is needed
function getYahooParams(timeframe: Timeframe): { interval: string; period: string; needsAggregation: boolean; aggregationFactor: number } {
  // For timeframes that Yahoo Finance supports directly
  const directSupport: Record<string, { interval: string; period: string }> = {
    '1d': { interval: '1d', period: '2y' }, // Increased period for more historical data
    '1w': { interval: '1wk', period: '5y' },
    '1M': { interval: '1mo', period: '10y' },
    '3M': { interval: '3mo', period: 'max' }
  };

  if (directSupport[timeframe]) {
    return { ...directSupport[timeframe], needsAggregation: false, aggregationFactor: 1 };
  }

  // For custom timeframes that need aggregation
  if (timeframe.endsWith('d')) {
    const days = parseInt(timeframe.replace('d', ''));
    return { 
      interval: '1d', 
      period: `${Math.min(days * 300, 1000)}d`, // Increased for more data
      needsAggregation: true, 
      aggregationFactor: days 
    };
  }

  if (timeframe.endsWith('w')) {
    const weeks = parseInt(timeframe.replace('w', ''));
    return { 
      interval: '1wk', 
      period: `${Math.min(weeks * 150, 400)}wk`, // Increased for more data
      needsAggregation: true, 
      aggregationFactor: weeks 
    };
  }

  if (timeframe.endsWith('M')) {
    const months = parseInt(timeframe.replace('M', ''));
    return { 
      interval: '1mo', 
      period: `${Math.min(months * 80, 200)}mo`, // Increased for more data
      needsAggregation: true, 
      aggregationFactor: months 
    };
  }

  // Default fallback
  return { interval: '1d', period: '2y', needsAggregation: false, aggregationFactor: 1 };
}

// Format symbol for Yahoo Finance (add exchange suffix for Indian stocks)
function formatSymbolForYahoo(symbol: string): string {
  // Common Indian stock exchanges
  const indianExchanges = ['.NS', '.BO']; // NSE and BSE
  
  // If it's already formatted with exchange, return as is
  if (indianExchanges.some(exchange => symbol.includes(exchange))) {
    return symbol;
  }
  
  // Common US symbols don't need formatting
  const commonUSSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'SPY'];
  if (commonUSSymbols.includes(symbol.toUpperCase())) {
    return symbol;
  }
  
  // For Indian symbols, try NSE first
  if (symbol.length <= 10 && !symbol.includes('.')) {
    return `${symbol}.NS`;
  }
  
  return symbol;
}

// Aggregate candles for custom timeframes
function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1) return candles;

  const aggregated: Candle[] = [];
  
  for (let i = 0; i < candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    if (group.length === 0) continue;

    const aggregatedCandle: Candle = {
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map(c => c.high)),
      low: Math.min(...group.map(c => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0)
    };

    aggregated.push(aggregatedCandle);
  }

  return aggregated;
}

export async function fetchSymbolData(symbol: string): Promise<Symbol | null> {
  try {
    const formattedSymbol = formatSymbolForYahoo(symbol);
    const url = `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_BASE}/${formattedSymbol}?interval=1d&range=2d`)}`;
    
    const response = await axios.get<YahooQuoteResponse>(url);
    const result = response.data.chart.result[0];
    
    if (!result) return null;
    
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;
    
    return {
      symbol: symbol.toUpperCase(),
      name: symbol, // We'll get the full name from search if needed
      price: currentPrice,
      change: change,
      changePercent: changePercent
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return null;
  }
}

export async function fetchChartData(symbol: string, timeframe: Timeframe): Promise<ChartData | null> {
  try {
    const formattedSymbol = formatSymbolForYahoo(symbol);
    const { interval, period, needsAggregation, aggregationFactor } = getYahooParams(timeframe);
    
    const url = `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_BASE}/${formattedSymbol}?interval=${interval}&range=${period}`)}`;
    
    const response = await axios.get<YahooQuoteResponse>(url);
    const result = response.data.chart.result[0];
    
    if (!result || !result.timestamp || !result.indicators.quote[0]) {
      return null;
    }
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    
    let candles: Candle[] = timestamps.map((timestamp, index) => ({
      timestamp: timestamp * 1000, // Convert to milliseconds
      open: quote.open[index] || 0,
      high: quote.high[index] || 0,
      low: quote.low[index] || 0,
      close: quote.close[index] || 0,
      volume: quote.volume[index] || 0
    })).filter(candle => candle.open > 0); // Filter out invalid data
    
    // Apply custom aggregation if needed
    if (needsAggregation && aggregationFactor > 1) {
      candles = aggregateCandles(candles, aggregationFactor);
    }
    
    // Limit to 500 candles maximum for performance
    if (candles.length > 500) {
      candles = candles.slice(-500);
    }
    
    // Calculate RSI and related indicators using improved method
    const rsi = calculateRSIData(candles);
    
    return { candles, rsi };
  } catch (error) {
    console.error(`Error fetching chart data for ${symbol}:`, error);
    return null;
  }
}

export async function searchSymbols(query: string): Promise<Symbol[]> {
  try {
    const url = `${CORS_PROXY}${encodeURIComponent(`${YAHOO_SEARCH_BASE}?q=${encodeURIComponent(query)}`)}`;
    
    const response = await axios.get<YahooSearchResponse>(url);
    const quotes = response.data.quotes || [];
    
    return quotes
      .filter(quote => quote.typeDisp === 'Equity' || quote.typeDisp === 'ETF')
      .slice(0, 10) // Limit to 10 results
      .map(quote => ({
        symbol: quote.symbol,
        name: quote.longname || quote.shortname || quote.symbol,
        price: 0, // Price will be fetched separately
        change: 0,
        changePercent: 0
      }));
  } catch (error) {
    console.error('Error searching symbols:', error);
    return [];
  }
}

// Improved RSI calculation using Wilder's smoothing method
function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Step 1: Calculate gains and losses
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      rsi.push(50); // Default RSI for first value
      continue;
    }
    
    const change = prices[i] - prices[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
    
    if (i < period) {
      rsi.push(50); // Default RSI for insufficient data
      continue;
    }
    
    let avgGain: number;
    let avgLoss: number;
    
    if (i === period) {
      // First calculation: simple average of first 14 periods
      avgGain = gains.slice(1, period + 1).reduce((sum, gain) => sum + gain, 0) / period;
      avgLoss = losses.slice(1, period + 1).reduce((sum, loss) => sum + loss, 0) / period;
    } else {
      // Subsequent calculations: Wilder's smoothing method
      const prevAvgGain = calculatePreviousAverage(gains, losses, i - 1, period).avgGain;
      const prevAvgLoss = calculatePreviousAverage(gains, losses, i - 1, period).avgLoss;
      
      avgGain = ((prevAvgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((prevAvgLoss * (period - 1)) + losses[i]) / period;
    }
    
    // Calculate RS and RSI
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      rsi.push(rsiValue);
    }
  }
  
  return rsi;
}

// Helper function to calculate previous average for Wilder's method
function calculatePreviousAverage(gains: number[], losses: number[], index: number, period: number): { avgGain: number; avgLoss: number } {
  if (index < period) {
    return { avgGain: 0, avgLoss: 0 };
  }
  
  if (index === period) {
    const avgGain = gains.slice(1, period + 1).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(1, period + 1).reduce((sum, loss) => sum + loss, 0) / period;
    return { avgGain, avgLoss };
  }
  
  // Recursive calculation for Wilder's method
  const prev = calculatePreviousAverage(gains, losses, index - 1, period);
  const avgGain = ((prev.avgGain * (period - 1)) + gains[index]) / period;
  const avgLoss = ((prev.avgLoss * (period - 1)) + losses[index]) / period;
  
  return { avgGain, avgLoss };
}

// Calculate RSI Simple Moving Average (14-period)
function calculateRSISMA(rsiValues: number[], period: number = 14): number[] {
  const rsiSMA: number[] = [];
  
  for (let i = 0; i < rsiValues.length; i++) {
    if (i < period - 1) {
      rsiSMA.push(rsiValues[i]); // Use current RSI value for insufficient data
      continue;
    }
    
    const sum = rsiValues.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    rsiSMA.push(sum / period);
  }
  
  return rsiSMA;
}

function calculateBollingerBands(values: number[], period: number = 20, multiplier: number = 2): { upper: number[], lower: number[] } {
  const sma = calculateRSISMA(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(values[i] + 10);
      lower.push(values[i] - 10);
      continue;
    }

    const slice = values.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + (multiplier * stdDev));
    lower.push(mean - (multiplier * stdDev));
  }

  return { upper, lower };
}

function calculateRSIData(candles: Candle[]): RSIData[] {
  const closePrices = candles.map(c => c.close);
  
  // Calculate RSI using improved Wilder's method
  const rsiValues = calculateRSI(closePrices, 14);
  
  // Calculate RSI-SMA (14-period simple moving average of RSI)
  const rsiSMA = calculateRSISMA(rsiValues, 14);
  
  // Calculate Bollinger Bands on RSI
  const rsiBB = calculateBollingerBands(rsiValues, 20, 2);
  
  return candles.map((candle, index) => ({
    timestamp: candle.timestamp,
    value: rsiValues[index],
    ma: rsiSMA[index], // This is now RSI-SMA (14)
    upperBB: rsiBB.upper[index],
    lowerBB: rsiBB.lower[index]
  }));
}

// Popular Indian and US symbols for quick access
export const POPULAR_SYMBOLS = {
  US: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'SPY', 'QQQ', 'BTC-USD', 'ETH-USD'],
  INDIAN: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS', 'LT.NS']
};