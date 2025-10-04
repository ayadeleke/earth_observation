import React from 'react';

export const ResultsPage = () => {
  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container">
        <h1 className="display-5 fw-bold text-dark mb-4">Analysis Results</h1>
        <div className="card shadow border-0 rounded">
          <div className="card-body p-4">
            <p className="text-muted">No analysis results found. Complete an analysis to see results here.</p>
            <div className="mt-3">
              <a 
                href="/analysis" 
                className="btn btn-primary px-4 py-2"
              >
                Start New Analysis
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
