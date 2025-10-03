import React from 'react';

export const DashboardPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Recent Projects */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Projects</h2>
            <p className="text-gray-600">No projects yet. Start by creating a new analysis.</p>
          </div>
          
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <a href="/analysis" className="block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-center">
                New Analysis
              </a>
              <a href="/projects" className="block bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-center">
                View Projects
              </a>
            </div>
          </div>
          
          {/* System Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">System Status</h2>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Earth Engine: Connected</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Django API: Running</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
