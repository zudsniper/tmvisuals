import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const { isDarkMode } = useTaskStore();
  const [query, setQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="relative w-full">
      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
        isDarkMode ? 'text-gray-400' : 'text-gray-400'
      }`} />
      <input
        type="text"
        placeholder="Search tasks..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className={`pl-10 pr-4 py-2 w-full rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isDarkMode 
            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:bg-gray-600' 
            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:bg-white'
        }`}
      />
    </div>
  );
};
