/**
 * Discord Snowflake ID Generator
 * Generates Twitter/Discord compatible 64-bit IDs encoded as decimal strings.
 * Epoch: 2015-01-01T00:00:00.000Z (1420070400000)
 */
export class Snowflake {
  public static readonly DISCORD_EPOCH = 1420070400000n;
  private static sequence = 0n;
  private static lastTimestamp = -1n;

  /**
   * Generates a new 64-bit Snowflake ID string.
   * @param workerId ID of the worker (0-31)
   * @param processId ID of the internal process (0-31)
   */
  public static generate(workerId = 1, processId = 1): string {
    let timestamp = BigInt(Date.now());

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 4095n;
      if (this.sequence === 0n) {
        // Clock sequence exhausted, wait until next millisecond
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const timeDiff = timestamp - this.DISCORD_EPOCH;
    const worker = BigInt(workerId & 31);
    const process = BigInt(processId & 31);

    const id = (timeDiff << 22n) | (worker << 17n) | (process << 12n) | this.sequence;

    return id.toString();
  }

  /**
   * Deconstructs a Snowflake string back into its creation timestamp Date.
   */
  public static toDate(snowflake: string): Date {
    const id = BigInt(snowflake);
    const timestamp = Number((id >> 22n) + this.DISCORD_EPOCH);
    return new Date(timestamp);
  }
}
