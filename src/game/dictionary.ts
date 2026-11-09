// Dictionary interface for word validation.
// Uses FISE 2017 word list (loaded at runtime from user-provided file).
//
// The FISE 2017 file format: one word per line, uppercase, no accents.
// The digit '1' represents the digraph CH, '2' represents LL, '3' represents RR.
// Ñ is stored as-is.

export class Dictionary {
  private words: Set<string>;
  private prefixes: Set<string>;
  private loaded = false;

  constructor() {
    this.words = new Set<string>();
    this.prefixes = new Set<string>();
  }

  private rebuildPrefixes() {
    this.prefixes = new Set();
    for (const w of this.words) {
      for (let i = 1; i < w.length; i++) {
        this.prefixes.add(w.slice(0, i));
      }
    }
  }

  loadWordList(wordArray: string[]): void {
    this.words = new Set();
    for (const w of wordArray) {
      const cleaned = normalizeWord(w);
      if (cleaned.length >= 2) {
        this.words.add(cleaned);
      }
    }
    this.rebuildPrefixes();
    this.loaded = true;
  }

  // Load from raw FISE 2017 text where 1=CH, 2=LL, 3=RR
  loadFiseText(text: string): number {
    this.words = new Set();
    const lines = text.split(/[\r\n]+/);
    for (const line of lines) {
      const raw = line.trim();
      if (raw.length < 2) continue;
      const converted = convertFiseDigits(raw);
      const cleaned = normalizeWord(converted);
      if (cleaned.length >= 2) {
        this.words.add(cleaned);
      }
    }
    this.rebuildPrefixes();
    this.loaded = true;
    return this.words.size;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  clear(): void {
    this.words = new Set();
    this.prefixes = new Set();
    this.loaded = false;
  }

  size(): number {
    return this.words.size;
  }

  isValid(word: string): boolean {
    return this.words.has(normalizeWord(word));
  }

  isPrefix(prefix: string): boolean {
    return this.prefixes.has(normalizeWord(prefix));
  }

  areValid(words: string[]): boolean {
    return words.every(w => this.isValid(w));
  }
}

// Convert FISE digit encoding to digraphs: 1->CH, 2->LL, 3->RR
export function convertFiseDigits(word: string): string {
  return word.replace(/1/g, 'CH').replace(/2/g, 'LL').replace(/3/g, 'RR');
}

// Normalize a word: uppercase, strip accents, keep Ñ as Ñ, keep CH/LL/RR as digraphs
export function normalizeWord(word: string): string {
  let result = word.toUpperCase().trim();
  result = result.replace(/Á/g, 'A');
  result = result.replace(/É/g, 'E');
  result = result.replace(/Í/g, 'I');
  result = result.replace(/Ó/g, 'O');
  result = result.replace(/Ú/g, 'U');
  result = result.replace(/Ü/g, 'U');
  return result;
}

export const dictionary = new Dictionary();
