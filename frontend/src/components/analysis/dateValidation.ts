export interface DateErrors {
  startDate?: string;
  endDate?: string;
}

// The first image each Earth Engine collection holds
const EARLIEST_IMAGES: Record<string, { date: string; label: string; satellite: string }> = {
  landsat: { date: '1984-03-16', label: '16 March 1984', satellite: 'Landsat' },
  sentinel1: { date: '2014-09-11', label: '11 September 2014', satellite: 'Sentinel-1' },
  sentinel2: { date: '2015-07-04', label: '4 July 2015', satellite: 'Sentinel-2' },
};

const earliestImage = (satellite: string) => EARLIEST_IMAGES[satellite] || EARLIEST_IMAGES.landsat;

export const earliestDate = (satellite: string) => earliestImage(satellite).date;

export const todayDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const validateDates = (
  startDate: string,
  endDate: string,
  satellite: string,
  today: string = todayDate()
): DateErrors => {
  const errors: DateErrors = {};
  const earliest = earliestImage(satellite);

  if (!startDate) {
    errors.startDate = 'Enter a start date.';
  } else if (startDate < earliest.date) {
    errors.startDate = `${earliest.satellite} images start on ${earliest.label}. Choose a later start date.`;
  } else if (startDate > today) {
    errors.startDate = "Start date can't be in the future.";
  }

  if (!endDate) {
    errors.endDate = 'Enter an end date.';
  } else if (endDate > today) {
    errors.endDate = "End date can't be later than today.";
  } else if (startDate && startDate >= endDate) {
    errors.endDate = 'End date must be after the start date.';
  }

  return errors;
};
