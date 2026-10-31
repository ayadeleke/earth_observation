import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnalysisForm } from '../analysis/AnalysisForm';
import { todayDate, validateDates } from '../analysis/dateValidation';

jest.mock('../upload/ShapefileUpload', () => ({ ShapefileUpload: () => null }));

const TODAY = '2026-10-31';

describe('validateDates', () => {
  it('accepts a range ending today', () => {
    expect(validateDates('2026-01-01', TODAY, 'landsat', TODAY)).toEqual({});
  });

  it('rejects an end date after today', () => {
    expect(validateDates('2026-01-01', '2026-11-01', 'landsat', TODAY).endDate).toBe("End date can't be later than today.");
  });

  it('rejects a start date in the future', () => {
    expect(validateDates('2026-11-01', '2026-11-02', 'landsat', TODAY).startDate).toBe("Start date can't be in the future.");
  });

  it('rejects an end date that is not after the start date', () => {
    expect(validateDates('2024-06-01', '2024-06-01', 'landsat', TODAY).endDate).toBe('End date must be after the start date.');
  });

  it('names the satellite when dates are too early for it', () => {
    expect(validateDates('2010-01-01', '2020-01-01', 'sentinel2', TODAY).startDate).toBe(
      'Sentinel-2 images start on 4 July 2015. Choose a later start date.'
    );
    expect(validateDates('2010-01-01', '2020-01-01', 'landsat', TODAY)).toEqual({});
  });

  it('asks for missing dates', () => {
    expect(validateDates('', '', 'landsat', TODAY)).toEqual({
      startDate: 'Enter a start date.',
      endDate: 'Enter an end date.',
    });
  });
});

describe('AnalysisForm dates', () => {
  const renderForm = (props = {}) => {
    const onSubmit = jest.fn();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const { container } = render(<AnalysisForm onSubmit={onSubmit} onAreaSelect={jest.fn()} {...props} />);
    return { onSubmit, form: container.querySelector('form') as HTMLFormElement };
  };

  it('allows choosing dates up to today', () => {
    renderForm();
    expect(screen.getByLabelText('End Date').getAttribute('max')).toBe(todayDate());
  });

  it('explains an invalid date instead of submitting', () => {
    const { onSubmit, form } = renderForm();
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2019-01-01' } });
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('End date must be after the start date.')).toBeInTheDocument();
  });

  it('submits valid dates', () => {
    const { onSubmit, form } = renderForm();
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: todayDate() } });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows analysis errors beside the run button', () => {
    renderForm({ error: 'No Landsat images found' });
    expect(screen.getByRole('alert')).toHaveTextContent('No Landsat images found');
  });
});
