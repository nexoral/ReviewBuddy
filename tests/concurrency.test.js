const { mapWithConcurrency } = require('../src/utils/concurrency');

describe('mapWithConcurrency', () => {
  test('preserves input order in the results regardless of completion order', async () => {
    const items = [30, 10, 20, 5, 25];
    const results = await mapWithConcurrency(items, 2, async (ms) => {
      await new Promise(resolve => setTimeout(resolve, ms));
      return ms;
    });
    expect(results).toEqual(items);
  });

  test('never runs more than `limit` callbacks concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = new Array(20).fill(0);

    await mapWithConcurrency(items, 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  test('handles an empty list', async () => {
    const results = await mapWithConcurrency([], 5, async (x) => x);
    expect(results).toEqual([]);
  });

  test('handles limit larger than the item count', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 100, async (x) => x * 2);
    expect(results).toEqual([2, 4, 6]);
  });
});
