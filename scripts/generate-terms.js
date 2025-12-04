#!/usr/bin/env node

/**
 * Script to generate random search terms and update config.js
 * Run with: node scripts/generate-terms.js
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "../src/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base word categories to combine for search terms
const wordBases = {
  adjectives: [
    "best",
    "top",
    "latest",
    "new",
    "popular",
    "amazing",
    "easy",
    "quick",
    "simple",
    "free",
    "cheap",
    "affordable",
    "professional",
    "beginner",
    "advanced",
    "modern",
    "classic",
    "traditional",
    "innovative",
    "creative",
    "healthy",
    "delicious",
    "beautiful",
    "stunning",
    "exciting",
    "interesting",
    "useful",
    "practical",
    "essential",
    "important",
  ],
  topics: [
    "recipes",
    "tips",
    "ideas",
    "trends",
    "news",
    "reviews",
    "guide",
    "tutorial",
    "tricks",
    "hacks",
    "secrets",
    "methods",
    "techniques",
    "strategies",
    "solutions",
    "benefits",
    "facts",
    "history",
    "stories",
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
    "games",
    "sports",
    "technology",
    "fashion",
    "art",
    "design",
    "architecture",
    "science",
    "nature",
    "animals",
    "cars",
    "motorcycles",
    "camping",
    "hiking",
    "cycling",
    "swimming",
    "running",
    "yoga",
    "meditation",
    "painting",
    "drawing",
    "crafts",
    "woodworking",
    "electronics",
    "programming",
    "marketing",
    "business",
    "finance",
    "investing",
    "cryptocurrency",
    "real estate",
    "interior design",
  ],
  timeframes: ["2025", "today", "this week", "this year", "winter", "summer", "spring", "fall", "weekend", "holiday"],
  actions: ["how to", "ways to", "learn", "discover", "explore", "find", "understand", "improve", "master", "start"],
  places: ["home", "outdoor", "beach", "mountain", "city", "country", "Europe", "Asia", "America", "local"],
  extras: [
    "for beginners",
    "for experts",
    "for kids",
    "for adults",
    "for families",
    "on a budget",
    "without equipment",
    "at home",
    "online",
    "step by step",
  ],
};

// Templates for generating search terms
const templates = [
  () => `${pick(wordBases.adjectives)} ${pick(wordBases.subjects)} ${pick(wordBases.topics)}`,
  () =>
    `${pick(wordBases.adjectives)} ${pick(wordBases.subjects)} ${pick(wordBases.topics)} ${pick(wordBases.timeframes)}`,
  () => `${pick(wordBases.actions)} ${pick(wordBases.subjects)}`,
  () => `${pick(wordBases.actions)} ${pick(wordBases.subjects)} ${pick(wordBases.extras)}`,
  () => `${pick(wordBases.subjects)} ${pick(wordBases.topics)} ${pick(wordBases.timeframes)}`,
  () => `${pick(wordBases.adjectives)} ${pick(wordBases.places)} ${pick(wordBases.subjects)}`,
  () => `${pick(wordBases.subjects)} ${pick(wordBases.extras)}`,
  () => `${pick(wordBases.actions)} ${pick(wordBases.adjectives)} ${pick(wordBases.subjects)}`,
  () => `${pick(wordBases.places)} ${pick(wordBases.subjects)} ${pick(wordBases.topics)}`,
  () => `${pick(wordBases.adjectives)} ${pick(wordBases.topics)} ${pick(wordBases.extras)}`,
];

/**
 * Pick a random element from an array
 * @param {string[]} array
 * @returns {string}
 */
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate unique random search terms
 * @param {number} count - Number of terms to generate
 * @returns {string[]}
 */
function generateSearchTerms(count) {
  const terms = new Set();
  let attempts = 0;
  const maxAttempts = count * 10;

  while (terms.size < count && attempts < maxAttempts) {
    const template = pick(templates);
    const term = template();
    terms.add(term);
    attempts++;
  }

  return Array.from(terms);
}

/**
 * Update the config.js file with new search terms
 * @param {string[]} terms
 */
function updateConfigFile(terms) {
  const configPath = join(__dirname, "..", "src", "config.js");
  let configContent = readFileSync(configPath, "utf-8");

  // Create the new searchTerms array string
  const termsString = terms.map((term) => `    "${term}"`).join(",\n");

  // Replace the searchTerms array using regex
  const searchTermsRegex = /searchTerms:\s*\[[\s\S]*?\]/;
  const newSearchTerms = `searchTerms: [\n${termsString},\n  ]`;

  configContent = configContent.replace(searchTermsRegex, newSearchTerms);

  writeFileSync(configPath, configContent, "utf-8");
}

// Main execution
const TERM_COUNT = config.maxSearches || 30;

console.log(`Generating ${TERM_COUNT} random search terms...\n`);

const searchTerms = generateSearchTerms(TERM_COUNT);

console.log("Generated terms:");
searchTerms.forEach((term, index) => {
  console.log(`  ${index + 1}. ${term}`);
});

updateConfigFile(searchTerms);

console.log(`\n✓ Updated config.js with ${searchTerms.length} search terms!`);
