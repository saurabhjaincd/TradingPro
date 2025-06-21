import React, { useEffect, useRef, useState } from 'react';
import { Candle, RSIData, Timeframe } from '../types/trading';

interface ChartProps {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  rsi: RSIData[];
  showRSI?: boolean;
}

interface TooltipData {
  x: number;
  y: number;
  price: number;
  rsi: number;
  timestamp: number;
  visible: boolean;
}

interface TechnicalIndicators {
  sma9: number[];
  sma50: number[];
  sma100: number[];
  sma200: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
}

export function Chart({ symbol, timeframe, candles, rsi, showRSI = true }: ChartProps) {
  const candleChartRef = useRef<HTMLCanvasElement>(null);
  const rsiChartRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData>({ x: 0, y: 0, price: 0, rsi: 0, timestamp: 0, visible: false });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [extendedCandles, setExtendedCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);

  // Generate extended candles for historical data with improved algorithm
  useEffect(() => {
    if (candles.length === 0) return;

    const extended = [...candles];
    const timeInterval = candles.length > 1 ? candles[1].timestamp - candles[0].timestamp : 3600000; // 1 hour default

    // Generate realistic historical data (up to 2000 candles total)
    const firstCandle = candles[0];
    const historicalCount = Math.min(1500, 2000 - candles.length); // Ensure total doesn't exceed 2000
    const historicalCandles: Candle[] = [];
    
    // Start with a reasonable base price (slightly lower than first real candle)
    let currentPrice = firstCandle.open * (0.85 + Math.random() * 0.1); // 85-95% of first candle open
    
    for (let i = historicalCount; i > 0; i--) {
      // Create more realistic price movement with trend and volatility
      const trendFactor = Math.sin(i / 100) * 0.001; // Long-term trend
      const volatility = 0.005 + Math.random() * 0.01; // 0.5% to 1.5% volatility
      const randomWalk = (Math.random() - 0.5) * volatility;
      
      // Calculate price change
      const priceChange = (trendFactor + randomWalk) * currentPrice;
      const newPrice = Math.max(currentPrice + priceChange, currentPrice * 0.01); // Prevent negative prices
      
      // Generate OHLC for this candle
      const open = currentPrice;
      const close = newPrice;
      
      // Generate realistic high and low
      const range = Math.abs(close - open);
      const extraRange = range * (0.2 + Math.random() * 0.8); // 20-100% extra range
      
      const high = Math.max(open, close) + extraRange * Math.random();
      const low = Math.min(open, close) - extraRange * Math.random();
      
      // Ensure low is not negative and high > low
      const finalLow = Math.max(low, newPrice * 0.01);
      const finalHigh = Math.max(high, finalLow + newPrice * 0.001);
      
      historicalCandles.unshift({
        timestamp: firstCandle.timestamp - (timeInterval * i),
        open: open,
        high: finalHigh,
        low: finalLow,
        close: close,
        volume: Math.floor(Math.random() * 500000) + 50000 // 50K to 550K volume
      });
      
      currentPrice = newPrice;
    }

    setExtendedCandles([...historicalCandles, ...extended]);
  }, [candles]);

  // Calculate technical indicators
  useEffect(() => {
    if (extendedCandles.length === 0) return;

    const closePrices = extendedCandles.map(c => c.close);
    
    const sma9 = calculateSMA(closePrices, 9);
    const sma50 = calculateSMA(closePrices, 50);
    const sma100 = calculateSMA(closePrices, 100);
    const sma200 = calculateSMA(closePrices, 200);
    
    const bb = calculateBollingerBands(closePrices, 20, 2);
    
    setIndicators({
      sma9,
      sma50,
      sma100,
      sma200,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower
    });
  }, [extendedCandles]);

  // Calculate visible candles based on zoom and pan (up to 2000 candles)
  const maxCandles = Math.floor(Math.min(2000, 400 / zoomLevel));
  const startIndex = Math.max(0, Math.min(extendedCandles.length - maxCandles, extendedCandles.length - maxCandles + panOffset));
  const endIndex = Math.min(extendedCandles.length, startIndex + maxCandles);
  const displayCandles = extendedCandles.slice(startIndex, endIndex);
  
  // Synchronize RSI with displayed candles - match exactly with price chart
  const actualCandlesCount = candles.length;
  const historicalCandlesCount = extendedCandles.length - actualCandlesCount;
  
  // Create synchronized RSI data that matches displayCandles exactly
  const synchronizedRsi: RSIData[] = [];
  displayCandles.forEach((candle, index) => {
    const globalIndex = startIndex + index;
    
    if (globalIndex >= historicalCandlesCount && globalIndex < historicalCandlesCount + rsi.length) {
      // This is a real candle with RSI data
      const rsiIndex = globalIndex - historicalCandlesCount;
      synchronizedRsi.push(rsi[rsiIndex]);
    } else {
      // This is a historical candle, generate realistic RSI
      const baseRsi = 45 + Math.sin(globalIndex / 20) * 10; // Oscillating between 35-55
      const noise = (Math.random() - 0.5) * 10; // Add some noise
      const mockRsi = Math.max(20, Math.min(80, baseRsi + noise)); // Keep within reasonable bounds
      
      synchronizedRsi.push({
        timestamp: candle.timestamp,
        value: mockRsi,
        ma: mockRsi + (Math.random() - 0.5) * 5, // Slight variation for MA
        upperBB: Math.min(80, mockRsi + 15 + Math.random() * 5),
        lowerBB: Math.max(20, mockRsi - 15 - Math.random() * 5)
      });
    }
  });

  useEffect(() => {
    drawCandlestickChart();
    if (showRSI) {
      drawRSIChart();
    }
  }, [displayCandles, synchronizedRsi, showRSI, zoomLevel, panOffset, indicators]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05; // Slower zoom
      setZoomLevel(prev => Math.max(0.1, Math.min(10, prev * delta)));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const sensitivity = 0.3; // Reduced sensitivity for smoother panning
        const panDelta = Math.round(deltaX * sensitivity);
        
        setPanOffset(prev => {
          const newOffset = prev - panDelta;
          const maxOffset = Math.max(0, extendedCandles.length - maxCandles);
          return Math.max(-maxOffset, Math.min(0, newOffset));
        });
        
        setLastMouseX(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        container.removeEventListener('wheel', handleWheel);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, lastMouseX, maxCandles, extendedCandles.length]);

  const calculateSMA = (prices: number[], period: number): number[] => {
    const sma: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  };

  const calculateBollingerBands = (prices: number[], period: number = 20, multiplier: number = 2): { upper: number[], middle: number[], lower: number[] } => {
    const sma = calculateSMA(prices, period);
    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        middle.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        upper.push(mean + (multiplier * stdDev));
        middle.push(mean);
        lower.push(mean - (multiplier * stdDev));
      }
    }

    return { upper, middle, lower };
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  };

  const formatDate = (timestamp: number, timeframe: Timeframe): string => {
    const date = new Date(timestamp);
    
    if (timeframe.includes('h') || timeframe.includes('H')) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (timeframe.includes('d') || timeframe.includes('D') || timeframe.includes('w') || timeframe.includes('W')) {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: '2-digit' 
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouseX(e.clientX);
  };

  const handleMouseMoveChart = (e: React.MouseEvent, chartType: 'price' | 'rsi') => {
    const canvas = chartType === 'price' ? candleChartRef.current : rsiChartRef.current;
    if (!canvas || displayCandles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const marginLeft = 80;
    const marginRight = 20;
    const chartWidth = rect.width - marginLeft - marginRight;
    
    if (x < marginLeft || x > marginLeft + chartWidth) {
      setTooltip(prev => ({ ...prev, visible: false }));
      return;
    }

    const dataIndex = Math.floor(((x - marginLeft) / chartWidth) * displayCandles.length);
    if (dataIndex >= 0 && dataIndex < displayCandles.length) {
      const candle = displayCandles[dataIndex];
      const rsiData = synchronizedRsi[dataIndex];
      
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        price: candle.close,
        rsi: rsiData?.value || 0,
        timestamp: candle.timestamp,
        visible: true
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const drawCandlestickChart = () => {
    const canvas = candleChartRef.current;
    if (!canvas || displayCandles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    const marginTop = 15;
    const marginBottom = 25;
    const marginLeft = 80;
    const marginRight = 20;
    
    const chartWidth = width - marginLeft - marginRight;
    const chartHeight = height - marginTop - marginBottom;
    
    // Calculate logarithmic price range with validation
    const prices = displayCandles.flatMap(c => [c.high, c.low]).filter(p => p > 0 && isFinite(p));
    if (prices.length === 0) return;
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Validate price range
    if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice <= 0 || maxPrice <= 0) {
      console.error('Invalid price range:', { minPrice, maxPrice });
      return;
    }
    
    const logMin = Math.log(minPrice);
    const logMax = Math.log(maxPrice);
    const logRange = logMax - logMin;
    const padding = logRange * 0.05;
    
    const adjustedLogMin = logMin - padding;
    const adjustedLogMax = logMax + padding;
    const adjustedLogRange = adjustedLogMax - adjustedLogMin;
    
    // Draw background grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    const priceGridLines = 5;
    for (let i = 0; i <= priceGridLines; i++) {
      const y = marginTop + (chartHeight / priceGridLines) * i;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(marginLeft + chartWidth, y);
      ctx.stroke();
    }
    
    const timeGridLines = Math.min(6, displayCandles.length);
    for (let i = 0; i <= timeGridLines; i++) {
      const x = marginLeft + (chartWidth / timeGridLines) * i;
      ctx.beginPath();
      ctx.moveTo(x, marginTop);
      ctx.lineTo(x, marginTop + chartHeight);
      ctx.stroke();
    }

    // Draw Bollinger Bands area
    if (indicators) {
      const startIdx = startIndex;
      const bbUpper = indicators.bbUpper.slice(startIdx, startIdx + displayCandles.length);
      const bbLower = indicators.bbLower.slice(startIdx, startIdx + displayCandles.length);
      
      ctx.beginPath();
      // Draw upper band
      bbUpper.forEach((value, index) => {
        if (!isNaN(value) && isFinite(value) && value > 0) {
          const x = marginLeft + (chartWidth / (displayCandles.length - 1)) * index;
          const y = marginTop + ((adjustedLogMax - Math.log(value)) / adjustedLogRange) * chartHeight;
          if (index === 0 || isNaN(bbUpper[index - 1])) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      
      // Draw lower band in reverse
      for (let i = bbLower.length - 1; i >= 0; i--) {
        const value = bbLower[i];
        if (!isNaN(value) && isFinite(value) && value > 0) {
          const x = marginLeft + (chartWidth / (displayCandles.length - 1)) * i;
          const y = marginTop + ((adjustedLogMax - Math.log(value)) / adjustedLogRange) * chartHeight;
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();

      // Draw Bollinger Band lines
      const drawBBLine = (values: number[], color: string, lineWidth: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        
        values.forEach((value, index) => {
          if (!isNaN(value) && isFinite(value) && value > 0) {
            const x = marginLeft + (chartWidth / (displayCandles.length - 1)) * index;
            const y = marginTop + ((adjustedLogMax - Math.log(value)) / adjustedLogRange) * chartHeight;
            
            if (index === 0 || isNaN(values[index - 1])) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        });
        
        ctx.stroke();
      };

      drawBBLine(bbUpper, '#3b82f6', 1);
      drawBBLine(indicators.bbMiddle.slice(startIdx, startIdx + displayCandles.length), '#3b82f6', 1);
      drawBBLine(bbLower, '#3b82f6', 1);
    }

    // Draw SMA lines with validation
    if (indicators) {
      const drawSMALine = (values: number[], color: string, lineWidth: number) => {
        const smaValues = values.slice(startIndex, startIndex + displayCandles.length);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        
        smaValues.forEach((value, index) => {
          if (!isNaN(value) && isFinite(value) && value > 0) {
            const x = marginLeft + (chartWidth / (displayCandles.length - 1)) * index;
            const y = marginTop + ((adjustedLogMax - Math.log(value)) / adjustedLogRange) * chartHeight;
            
            if (index === 0 || isNaN(smaValues[index - 1])) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        });
        
        ctx.stroke();
      };

      drawSMALine(indicators.sma9, '#3b82f6', 1);
      drawSMALine(indicators.sma50, '#ef4444', 2);
      drawSMALine(indicators.sma100, '#eab308', 2);
      drawSMALine(indicators.sma200, '#1e40af', 2);
    }
    
    // Draw price labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= priceGridLines; i++) {
      const y = marginTop + (chartHeight / priceGridLines) * i;
      const logPrice = adjustedLogMax - (adjustedLogRange / priceGridLines) * i;
      const price = Math.exp(logPrice);
      if (isFinite(price) && price > 0) {
        ctx.fillText('$' + formatPrice(price), marginLeft - 10, y);
      }
    }
    
    // Draw time labels - synchronized with candles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#6b7280';
    const labelInterval = Math.max(1, Math.floor(displayCandles.length / 6));
    
    for (let i = 0; i < displayCandles.length; i += labelInterval) {
      const x = marginLeft + (chartWidth / (displayCandles.length - 1)) * i;
      const timeLabel = formatDate(displayCandles[i].timestamp, timeframe);
      ctx.fillText(timeLabel, x, marginTop + chartHeight + 8);
    }
    
    // Calculate candle dimensions
    const candleWidth = Math.max(1, Math.min(8, chartWidth / displayCandles.length * 0.7));
    const candleSpacing = chartWidth / (displayCandles.length - 1);
    
    // Draw candles with validation
    displayCandles.forEach((candle, index) => {
      // Validate candle data
      if (!isFinite(candle.open) || !isFinite(candle.high) || !isFinite(candle.low) || !isFinite(candle.close) ||
          candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
        return; // Skip invalid candles
      }
      
      const x = marginLeft + index * candleSpacing;
      
      // Calculate Y positions using logarithmic scale
      const openY = marginTop + ((adjustedLogMax - Math.log(candle.open)) / adjustedLogRange) * chartHeight;
      const closeY = marginTop + ((adjustedLogMax - Math.log(candle.close)) / adjustedLogRange) * chartHeight;
      const highY = marginTop + ((adjustedLogMax - Math.log(candle.high)) / adjustedLogRange) * chartHeight;
      const lowY = marginTop + ((adjustedLogMax - Math.log(candle.low)) / adjustedLogRange) * chartHeight;
      
      const isGreen = candle.close >= candle.open;
      const color = isGreen ? '#22c55e' : '#ef4444'; // Lighter green for bullish candles
      
      // Draw wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw candle body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));
      
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      
      if (!isGreen) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      }
    });
    
    // Draw chart border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginLeft, marginTop, chartWidth, chartHeight);
  };

  const drawRSIChart = () => {
    const canvas = rsiChartRef.current;
    if (!canvas || synchronizedRsi.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    const marginTop = 10;
    const marginBottom = 20;
    const marginLeft = 80;
    const marginRight = 20;
    
    const chartWidth = width - marginLeft - marginRight;
    const chartHeight = height - marginTop - marginBottom;
    
    const rsiMin = 20;
    const rsiMax = 85;
    const rsiRange = rsiMax - rsiMin;
    
    // Draw background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(marginLeft, marginTop, chartWidth, chartHeight);
    
    // Draw RSI zones
    const zone40Y = marginTop + (chartHeight * (rsiMax - 40)) / rsiRange;
    const zone60Y = marginTop + (chartHeight * (rsiMax - 60)) / rsiRange;
    
    ctx.fillStyle = 'rgba(147, 51, 234, 0.1)';
    ctx.fillRect(marginLeft, zone60Y, chartWidth, zone40Y - zone60Y);
    
    // Draw Bollinger Bands background
    const pointSpacing = chartWidth / (synchronizedRsi.length - 1);
    
    ctx.beginPath();
    synchronizedRsi.forEach((point, index) => {
      const value = Math.min(rsiMax, Math.max(rsiMin, point.upperBB));
      if (isFinite(value)) {
        const x = marginLeft + index * pointSpacing;
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    
    for (let i = synchronizedRsi.length - 1; i >= 0; i--) {
      const value = Math.min(rsiMax, Math.max(rsiMin, synchronizedRsi[i].lowerBB));
      if (isFinite(value)) {
        const x = marginLeft + i * pointSpacing;
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
    ctx.fill();
    
    // Draw reference lines
    const referenceLines = [
      { value: 40, color: '#9ca3af', width: 1.2 },
      { value: 50, color: '#d1d5db', width: 1 },
      { value: 60, color: '#9ca3af', width: 1.2 }
    ];
    
    referenceLines.forEach(({ value, color, width }) => {
      const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(marginLeft + chartWidth, y);
      ctx.stroke();
    });
    
    ctx.setLineDash([]);
    
    // RSI labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const labelValues = [80, 60, 50, 40, 25];
    labelValues.forEach(value => {
      if (value >= rsiMin && value <= rsiMax) {
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        ctx.fillText(value.toString(), marginLeft - 5, y);
      }
    });
    
    // Draw time labels - synchronized with price chart
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#6b7280';
    const labelInterval = Math.max(1, Math.floor(synchronizedRsi.length / 6));
    
    for (let i = 0; i < synchronizedRsi.length; i += labelInterval) {
      const x = marginLeft + (chartWidth / (synchronizedRsi.length - 1)) * i;
      const timeLabel = formatDate(synchronizedRsi[i].timestamp, timeframe);
      ctx.fillText(timeLabel, x, marginTop + chartHeight + 8);
    }
    
    // Draw Bollinger Bands with validation
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    // Upper Bollinger Band
    ctx.beginPath();
    synchronizedRsi.forEach((point, index) => {
      const value = Math.min(rsiMax, Math.max(rsiMin, point.upperBB));
      if (isFinite(value)) {
        const x = marginLeft + index * pointSpacing;
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Lower Bollinger Band
    ctx.beginPath();
    synchronizedRsi.forEach((point, index) => {
      const value = Math.min(rsiMax, Math.max(rsiMin, point.lowerBB));
      if (isFinite(value)) {
        const x = marginLeft + index * pointSpacing;
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw RSI-SMA with validation
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    synchronizedRsi.forEach((point, index) => {
      const value = Math.min(rsiMax, Math.max(rsiMin, point.ma));
      if (isFinite(value)) {
        const x = marginLeft + index * pointSpacing;
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.stroke();
    
    // Draw RSI line with validation
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    synchronizedRsi.forEach((point, index) => {
      const value = Math.min(rsiMax, Math.max(rsiMin, point.value));
      if (isFinite(value)) {
        const x = marginLeft + index * pointSpacing;
        const y = marginTop + (chartHeight * (rsiMax - value)) / rsiRange;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    
    ctx.stroke();
    
    // Draw chart border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginLeft, marginTop, chartWidth, chartHeight);
  };

  return (
    <div 
      ref={containerRef} 
      className="bg-white border border-gray-300 rounded-lg shadow-sm flex flex-col h-full transition-all duration-500"
    >
      <div className="flex-1 flex flex-col min-h-0">
        <div className={showRSI ? "h-3/4" : "h-full"}>
          <canvas
            ref={candleChartRef}
            className="w-full h-full cursor-crosshair"
            onMouseMove={(e) => handleMouseMoveChart(e, 'price')}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
          />
        </div>
        
        {showRSI && (
          <>
            <div className="h-1 bg-gradient-to-r from-transparent via-gray-400 to-transparent my-1"></div>
            
            <div className="h-1/4">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1 px-3">
                <span className="font-medium">RSI (14)</span>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
                    <span>RSI</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-red-500 rounded"></div>
                    <span>SMA</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-0.5 bg-green-500 rounded"></div>
                    <span>BB</span>
                  </div>
                </div>
              </div>
              <canvas
                ref={rsiChartRef}
                className="w-full h-full cursor-crosshair"
                onMouseMove={(e) => handleMouseMoveChart(e, 'rsi')}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
              />
            </div>
          </>
        )}
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 shadow-lg border border-gray-600"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div>Price: ${formatPrice(tooltip.price)}</div>
          <div>RSI: {tooltip.rsi.toFixed(1)}</div>
          <div>{new Date(tooltip.timestamp).toLocaleString()}</div>
        </div>
      )}

      {/* Legend */}
      <div className="px-3 py-1 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
              <span>SMA9</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-0.5 bg-red-500 rounded" style={{ height: '2px' }}></div>
              <span>SMA50</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-0.5 bg-yellow-600 rounded" style={{ height: '2px' }}></div>
              <span>SMA100</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-0.5 bg-blue-800 rounded" style={{ height: '2px' }}></div>
              <span>SMA200</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-2 bg-blue-200 border border-blue-500 rounded"></div>
            <span>Bollinger Bands</span>
          </div>
        </div>
      </div>
    </div>
  );
}