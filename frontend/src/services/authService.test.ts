export {};

const mockApi: any = jest.fn();
mockApi.get = jest.fn();
mockApi.post = jest.fn();
mockApi.interceptors = {
  request: { use: jest.fn() },
  response: { use: jest.fn() },
};

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: () => mockApi },
}));

const loadService = (tokens: object | null = { access: 'old-access', refresh: 'refresh' }) => {
  localStorage.clear();
  if (tokens) {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    localStorage.setItem('user_data', JSON.stringify({ email: 'user@example.com' }));
  }
  let service: any;
  jest.isolateModules(() => {
    service = require('./authService').default;
  });
  const calls = mockApi.interceptors.response.use.mock.calls;
  return { service, onResponseError: calls[calls.length - 1][1] };
};

const expiredRequestError = () => ({
  config: { url: '/profile/', headers: {} },
  response: { status: 401 },
});

describe('verifyToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the session while the server is unreachable', async () => {
    const { service } = loadService();
    mockApi.get.mockRejectedValue(new Error('Network Error'));
    await expect(service.verifyToken()).resolves.toBe(true);
  });

  it('keeps the session when the server is waking up', async () => {
    const { service } = loadService();
    mockApi.get.mockRejectedValue({ response: { status: 502 } });
    await expect(service.verifyToken()).resolves.toBe(true);
  });

  it('ends the session on a 401', async () => {
    const { service } = loadService();
    mockApi.get.mockRejectedValue({ response: { status: 401 } });
    await expect(service.verifyToken()).resolves.toBe(false);
  });
});

describe('an expired access token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is refreshed and the request is retried with the new token', async () => {
    const { service, onResponseError } = loadService();
    mockApi.post.mockResolvedValue({ data: { access: 'new-access' } });
    mockApi.mockResolvedValue({ status: 200 });

    await onResponseError(expiredRequestError());

    expect(mockApi.mock.calls[0][0].headers.Authorization).toBe('Bearer new-access');
    expect(service.getAccessToken()).toBe('new-access');
  });

  it('keeps the session when the refresh cannot reach the server', async () => {
    const { service, onResponseError } = loadService();
    mockApi.post.mockRejectedValue(new Error('Network Error'));

    await expect(onResponseError(expiredRequestError())).rejects.toThrow('Network Error');

    expect(service.getAccessToken()).toBe('old-access');
  });
});
