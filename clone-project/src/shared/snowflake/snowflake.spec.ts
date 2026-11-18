import { Snowflake } from './snowflake';

describe('Snowflake ID Generator Unit Tests', () => {
  it('should generate a valid snowflake ID string', () => {
    const id = Snowflake.generate();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(15);
  });

  it('should generate monotonically increasing unique IDs in sequence', () => {
    const id1 = Snowflake.generate();
    const id2 = Snowflake.generate();
    const id3 = Snowflake.generate();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(BigInt(id2)).toBeGreaterThan(BigInt(id1));
    expect(BigInt(id3)).toBeGreaterThan(BigInt(id2));
  });

  it('should accurately deconstruct the creation timestamp date', () => {
    const before = Date.now();
    const id = Snowflake.generate();
    const after = Date.now();

    const date = Snowflake.toDate(id);
    expect(date.getTime()).toBeGreaterThanOrEqual(before);
    expect(date.getTime()).toBeLessThanOrEqual(after);
  });
});
