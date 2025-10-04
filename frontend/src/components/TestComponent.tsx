import React from 'react';

// Simple test component to verify JSX compilation
export const TestComponent: React.FC = () => {
  return (
    <div className="test">
      <h1>Test Component</h1>
      <p>This is a test to verify JSX elements work properly.</p>
      <button type="button">Test Button</button>
    </div>
  );
};

export default TestComponent;
