export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.updatedAt = now();
  }

  take(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  private refill(): void {
    const now = this.now();
    const elapsed = Math.max(0, now - this.updatedAt) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.updatedAt = now;
  }
}
