import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AIAssistant } from '../ai/AIAssistant';
import authService from '../../services/authService';

jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: { getAuthenticatedAPI: jest.fn() },
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe('AIAssistant', () => {
  it('sends questions through the client that renews expired logins', async () => {
    const post = jest.fn().mockResolvedValue({ data: { response: 'NDVI measures vegetation.', suggestions: [] } });
    (authService.getAuthenticatedAPI as jest.Mock).mockReturnValue({ post });

    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What is NDVI?' } });
    fireEvent.keyPress(screen.getByRole('textbox'), { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => expect(screen.getByText('NDVI measures vegetation.')).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/ai/query/', expect.objectContaining({ message: 'What is NDVI?' }));
  });
});
