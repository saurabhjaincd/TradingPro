export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Symbol {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface RSIData {
  timestamp: number;
  value: number;
  ma: number;
  upperBB: number;
  lowerBB: number;
}

export type Timeframe = '1d' | '2d' | '3d' | '4d' | '1w' | '6d' | '7d' | '2w' | '3w' | '1M' | '5w' | '6w' | '2M' | '3M';

export interface ChartData {
  candles: Candle[];
  rsi: RSIData[];
}

export interface CustomTimeframe {
  label: string;
  value: string;
  minutes?: number;
  days?: number;
  weeks?: number;
  months?: number;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WatchlistData {
  watchlist: Watchlist;
  symbolData: Symbol[];
}