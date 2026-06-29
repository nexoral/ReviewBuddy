jest.mock('../src/utils', () => {
  const original = jest.requireActual('../src/utils');
  return {
    ...original,
    logInfo: jest.fn(),
    logSuccess: jest.fn(),
    logWarning: jest.fn(),
    logError: jest.fn()
  };
});

const { fetchPRComments, fetchPRDetails } = require('../src/github');

describe('GitHub API module', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('fetchPRDetails should return JSON details on success', async () => {
    const mockDetails = { id: 123, title: 'Test PR' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockDetails)
    });

    const details = await fetchPRDetails('owner/repo', 1, 'token');
    expect(details).toEqual(mockDetails);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/1',
      expect.any(Object)
    );
  });

  test('fetchPRDetails should throw error on HTTP failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    await expect(fetchPRDetails('owner/repo', 1, 'token')).rejects.toThrow(/HTTP error! status: 404/);
  });

  test('fetchPRComments should paginate and aggregate all comments', async () => {
    // Page 1: 100 comments
    const page1Comments = Array.from({ length: 100 }, (_, i) => ({ id: i, body: `Comment ${i}` }));
    // Page 2: 50 comments
    const page2Comments = Array.from({ length: 50 }, (_, i) => ({ id: i + 100, body: `Comment ${i + 100}` }));

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(page1Comments)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(page2Comments)
      });

    const comments = await fetchPRComments('owner/repo', 1, 'token');

    expect(comments).toHaveLength(150);
    expect(comments[0].body).toBe('Comment 0');
    expect(comments[149].body).toBe('Comment 149');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1,
      'https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100&page=1',
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2,
      'https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100&page=2',
      expect.any(Object)
    );
  });
});
