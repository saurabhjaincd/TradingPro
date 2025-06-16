import React from 'react';
import { Timeframe } from '../types/trading';

interface TimeframeSelectorProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  className?: string;
}

const defaultTimeframes: { label: string; value: Timeframe }[] = [
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

export function TimeframeSelector({ selectedTimeframe, onTimeframeChange, className = '' }: TimeframeSelectorProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <div className="flex flex-wrap gap-1">
        {defaultTimeframes.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onTimeframeChange(value)}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors border ${
              selectedTimeframe === value
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}