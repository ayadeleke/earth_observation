import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from '../../pages/AboutPage';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const renderFor = (isAuthenticated: boolean) => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated });
  render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>
  );
  return screen.getByRole('link', { name: 'Get Started Free' });
};

describe('Get Started Free on the about page', () => {
  it('takes signed-in users to their dashboard', () => {
    expect(renderFor(true).getAttribute('href')).toBe('/dashboard');
  });

  it('takes everyone else to the register page', () => {
    expect(renderFor(false).getAttribute('href')).toBe('/register');
  });
});
