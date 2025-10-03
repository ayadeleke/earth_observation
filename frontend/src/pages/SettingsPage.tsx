import React from 'react';

export const SettingsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Application Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Satellite
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="sentinel2">Sentinel-2</option>
                <option value="landsat8">Landsat 8</option>
                <option value="sentinel1">Sentinel-1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Map Style
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="satellite">Satellite</option>
                <option value="terrain">Terrain</option>
                <option value="roadmap">Roadmap</option>
              </select>
            </div>
            <div className="mt-6">
              <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
