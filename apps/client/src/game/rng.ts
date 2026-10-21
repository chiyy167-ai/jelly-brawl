/** mulberry32：同一种子得到同一串随机数，后续联机时用来复现。 */
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(max: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.next();
    },
    int(max) {
      return Math.floor(this.next() * max);
    },
  };
}
