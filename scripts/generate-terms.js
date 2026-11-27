#!/usr/bin/env node

/**
 * Offline fallback script to generate random English search terms and write
 * them to `src/generated/search-terms-{desktop|mobile}.json`.
 *
 * Run with:
 *   node scripts/generate-terms.js
 *   node scripts/generate-terms.js --mobile
 */

import { mkdir, writeFile } from "node:fs/promises";
import { config, getMaxSearches, isMobileMode } from "../src/config.js";
import { GENERATED_DIR, getSearchTermsPath, resolveTermCount } from "../src/generateTermsGemini.js";

const wordBases = {
  adjectives: [
    "best",
    "top",
    "popular",
    "easy",
    "quick",
    "simple",
    "free",
    "affordable",
    "beginner",
    "modern",
    "classic",
    "healthy",
    "practical",
    "essential",
  ],
  topics: [
    "recipes",
    "tips",
    "ideas",
    "guide",
    "tutorial",
    "methods",
    "techniques",
    "strategies",
    "solutions",
    "benefits",
    "facts",
    "history",
    "examples",
  ],
  subjects: [
    "cooking",
    "travel",
    "fitness",
    "photography",
    "gardening",
    "music",
    "movies",
    "books",
    "board games",
    "technology",
    "interior design",
    "architecture",
    "astronomy",
    "camping",
    "hiking",
    "cycling",
    "running",
    "yoga",
    "meditation",
    "woodworking",
    "electronics",
    "programming",
    "personal finance",
    "home organization",
  ],
  actions: ["how to start", "ways to improve", "how to learn", "how to organize", "how to choose"],
  places: ["home", "outdoor", "beach", "mountain", "city", "Europe", "Asia", "South America"],
  extras: ["for beginners", "for families", "on a budget", "without equipment", "at home", "step by step"],
};

const templates = [
  () => `${pick(wordBases.adjectives)} ${pick(wordBases.subjects)} ${pick(wordBases.topics)}`,
  () => `${pick(wordBases.actions)} ${pick(wordBases.subjects)}`,
  () => `${pick(wordBases.actions)} ${pick(wordBases.subjects)} ${pick(wordBases.extras)}`,
  () => `${pick(wordBases.subjects)} ${pick(wordBases.topics)} ${pick(wordBases.extras)}`,
  () => `${pick(wordBases.adjectives)} ${pick(wordBases.places)} ${pick(wordBases.subjects)} ${pick(wordBases.topics)}`,
  () => `${pick(wordBases.subjects)} ${pick(wordBases.extras)}`,
];

/**
 * Picks a random element from an array.
 * @template T
 * @param {T[]} array
 * @returns {T}
 */
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates unique random search terms.
 * @param {number} count
 * @returns {string[]}
 */
function generateSearchTerms(count) {
  /** @type {Set<string>} */
  const terms = new Set();
  let attempts = 0;
  const maxAttempts = count * 20;

  while (terms.size < count && attempts < maxAttempts) {
    terms.add(pick(templates)());
    attempts++;
  }

  return Array.from(terms);
}

const mobileMode = isMobileMode();
const termCount = resolveTermCount(getMaxSearches(config, mobileMode), config.defaultTermCount);
const outputPath = getSearchTermsPath(mobileMode);
const modeLabel = mobileMode ? "Mobile" : "Desktop";

console.log(`Generating ${termCount} offline English search terms for ${modeLabel} mode...\n`);

const searchTerms = generateSearchTerms(termCount);

console.log("Generated terms:");
searchTerms.forEach((term, index) => {
  console.log(`  ${index + 1}. ${term}`);
});

await mkdir(GENERATED_DIR, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(searchTerms, null, 2)}\n`, "utf-8");

console.log(`\n✓ Saved ${searchTerms.length} search terms to ${outputPath}`);
