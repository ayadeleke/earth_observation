import React from 'react';

export const ResultsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analysis Results</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No analysis results found. Complete an analysis to see results here.</p>
          <div className="mt-4">
            <a 
              href="/analysis" 
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block"
            >
              Start New Analysis
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
