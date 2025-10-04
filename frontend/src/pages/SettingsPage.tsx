import React from 'react';

export const SettingsPage = () => {
  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container">
        <h1 className="display-5 fw-bold text-dark mb-4">Settings</h1>
        <div className="card shadow border-0 rounded">
          <div className="card-body p-4">
            <h2 className="h4 fw-semibold text-dark mb-4">Application Settings</h2>
            <div className="row g-4">
              <div className="col-12">
                <label className="form-label fw-semibold text-muted">
                  Default Satellite
                </label>
                <select className="form-select border-secondary">
                  <option value="sentinel2">Sentinel-2</option>
                  <option value="landsat8">Landsat 8</option>
                  <option value="sentinel1">Sentinel-1</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold text-muted">
                  Map Style
                </label>
                <select className="form-select border-secondary">
                  <option value="satellite">Satellite</option>
                  <option value="terrain">Terrain</option>
                  <option value="roadmap">Roadmap</option>
                </select>
              </div>
              <div className="col-12 mt-4">
                <button className="btn btn-primary px-4 py-2">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
