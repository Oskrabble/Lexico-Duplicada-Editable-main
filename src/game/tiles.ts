// Official Spanish Scrabble tile distribution (100 tiles, FISE)
// Outside North America edition with CH, LL, RR as single tiles.
// K and W are omitted; blanks cannot be used as K or W.

export interface TileDef {
  letter: string;
  value: number;
  count: number;
}

export const SPANISH_TILES: TileDef[] = [
  // 0 puntos - comodines
  { letter: '?', value: 0, count: 2 },
  // 1 punto
  { letter: 'A', value: 1, count: 12 },
  { letter: 'E', value: 1, count: 12 },
  { letter: 'I', value: 1, count: 6 },
  { letter: 'L', value: 1, count: 4 },
  { letter: 'N', value: 1, count: 5 },
  { letter: 'O', value: 1, count: 9 },
  { letter: 'R', value: 1, count: 5 },
  { letter: 'S', value: 1, count: 6 },
  { letter: 'T', value: 1, count: 4 },
  { letter: 'U', value: 1, count: 5 },
  // 2 puntos
  { letter: 'D', value: 2, count: 5 },
  { letter: 'G', value: 2, count: 2 },
  // 3 puntos
  { letter: 'B', value: 3, count: 2 },
  { letter: 'C', value: 3, count: 4 },
  { letter: 'M', value: 3, count: 2 },
  { letter: 'P', value: 3, count: 2 },
  // 4 puntos
  { letter: 'F', value: 4, count: 1 },
  { letter: 'H', value: 4, count: 2 },
  { letter: 'V', value: 4, count: 1 },
  { letter: 'Y', value: 4, count: 1 },
  // 5 puntos
  { letter: 'CH', value: 5, count: 1 },
  { letter: 'Q', value: 5, count: 1 },
  // 8 puntos
  { letter: 'J', value: 8, count: 1 },
  { letter: 'LL', value: 8, count: 1 },
  { letter: 'Ñ', value: 8, count: 1 },
  { letter: 'RR', value: 8, count: 1 },
  { letter: 'X', value: 8, count: 1 },
  // 10 puntos
  { letter: 'Z', value: 10, count: 1 },
];

// Letters that cannot be represented by a blank
export const FORBIDDEN_BLANK_LETTERS = new Set(['K', 'W']);

// Multi-letter tiles (digraphs)
export const MULTI_LETTER_TILES = new Set(['CH', 'LL', 'RR']);

// Map from letter to value
export const LETTER_VALUES: Record<string, number> = {};
for (const t of SPANISH_TILES) {
  LETTER_VALUES[t.letter] = t.value;
}

// Vowels in Spanish Scrabble (Ñ is a consonant; digraphs CH/LL/RR are consonants)
export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Count vowels and consonants in a set of rack letters.
// Blanks ('?') are NOT counted here; they are assigned separately to fill deficits.
export function countVowelsConsonants(letters: string[]): { vowels: number; consonants: number; blanks: number } {
  let vowels = 0;
  let consonants = 0;
  let blanks = 0;
  for (const l of letters) {
    if (l === '?') {
      blanks++;
    } else if (VOWELS.has(l)) {
      vowels++;
    } else {
      consonants++;
    }
  }
  return { vowels, consonants, blanks };
}

// Check whether a rack satisfies the FISE duplicate rule:
// at least 2 vowels and at least 2 consonants.
// Blanks fill the deficit: each blank counts as a vowel if vowels < 2,
// otherwise as a consonant if consonants < 2.
export function rackMeetsVowelConsonantRule(letters: string[]): boolean {
  const { vowels, consonants, blanks } = countVowelsConsonants(letters);
  let v = vowels;
  let c = consonants;
  for (let i = 0; i < blanks; i++) {
    if (v < 2) v++;
    else if (c < 2) c++;
  }
  return v >= 2 && c >= 2;
}

// Determine whether it is POSSIBLE to ever satisfy the 2-vowel / 2-consonant rule
// given the remaining bag and the current rack. Used to detect game-over.
// Returns true if some combination of bag + rack could yield a valid 7-tile rack
// (or, when fewer than 7 tiles remain in total, the available tiles) meeting the rule.
export function canEverSatisfyRule(rackLetters: string[], bagLetters: string[]): boolean {
  const { vowels: rv, consonants: rc, blanks: rb } = countVowelsConsonants(rackLetters);
  const { vowels: bv, consonants: bc, blanks: bb } = countVowelsConsonants(bagLetters);

  const totalVowels = rv + bv;
  const totalConsonants = rc + bc;
  const totalBlanks = rb + bb;

  // Best case: use blanks to fill whichever side is more deficient.
  // We need at least 2 vowels and 2 consonants across all available tiles.
  let v = totalVowels;
  let c = totalConsonants;
  for (let i = 0; i < totalBlanks; i++) {
    if (v < 2) v++;
    else if (c < 2) c++;
  }
  return v >= 2 && c >= 2;
}

// Draw a rack of `count` tiles from the bag, enforcing the 2-vowel / 2-consonant rule.
// If the drawn set does not satisfy the rule, return ALL drawn tiles to the bag,
// reshuffle, and redraw — repeating until the rule is met or it becomes impossible.
// Returns the drawn letters and the remaining bag (with drawn tiles removed).
export function drawRackWithRule(
  bag: string[],
  count: number
): { rackLetters: string[]; remaining: string[] } {
  return refillRackWithRule([], bag, count);
}

// Refill a rack that already holds `keptLetters`, drawing from the bag so the
// combined rack (kept + drawn) has `totalCount` tiles and satisfies the
// 2-vowel / 2-consonant rule. If a draw fails the rule, all drawn tiles go back
// to the bag and we reshuffle and try again.
export function refillRackWithRule(
  keptLetters: string[],
  bag: string[],
  totalCount: number
): { rackLetters: string[]; remaining: string[] } {
  const need = Math.max(0, totalCount - keptLetters.length);
  if (need === 0) {
    return { rackLetters: keptLetters, remaining: bag };
  }

  // If it's impossible to ever satisfy the rule with the available tiles,
  // do a best-effort draw to avoid an infinite loop.
  if (!canEverSatisfyRule(keptLetters, bag)) {
    const shuffled = shuffle(bag);
    const drawCount = Math.min(need, bag.length);
    return {
      rackLetters: [...keptLetters, ...shuffled.slice(0, drawCount)],
      remaining: shuffled.slice(drawCount),
    };
  }

  // Phase 1: try drawing just the needed tiles while keeping existing tiles.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const shuffled = shuffle(bag);
    const drawCount = Math.min(need, bag.length);
    const drawn = shuffled.slice(0, drawCount);
    const remaining = shuffled.slice(drawCount);
    const fullRack = [...keptLetters, ...drawn];
    if (rackMeetsVowelConsonantRule(fullRack)) {
      return { rackLetters: fullRack, remaining };
    }
  }

  // Phase 2: return ALL rack tiles (kept + drawn) to the bag and draw
  // totalCount fresh tiles entirely at random until the rule is met.
  const allTiles = [...keptLetters, ...bag];
  for (let attempt = 0; attempt < 1000; attempt++) {
    const shuffled = shuffle(allTiles);
    const drawCount = Math.min(totalCount, allTiles.length);
    const rackLetters = shuffled.slice(0, drawCount);
    const remaining = shuffled.slice(drawCount);
    if (rackMeetsVowelConsonantRule(rackLetters)) {
      return { rackLetters, remaining };
    }
  }

  // Best-effort fallback
  const shuffled = shuffle(bag);
  const drawCount = Math.min(need, bag.length);
  return {
    rackLetters: [...keptLetters, ...shuffled.slice(0, drawCount)],
    remaining: shuffled.slice(drawCount),
  };
}

// Total tiles = 100
export const TOTAL_TILES = SPANISH_TILES.reduce((sum, t) => sum + t.count, 0);

// Build the full bag of tiles as an array of letter strings
export function buildTileBag(): string[] {
  const bag: string[] = [];
  for (const t of SPANISH_TILES) {
    for (let i = 0; i < t.count; i++) {
      bag.push(t.letter);
    }
  }
  return bag;
}

// Shuffle helper
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
