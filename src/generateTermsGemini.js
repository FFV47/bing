import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { config, getGeminiApiKey, getMaxSearches, isMobileMode } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const GENERATED_DIR = join(__dirname, "generated");

/** Validation schema for generated and persisted search terms */
export const SearchTermsSchema = z.array(z.string().trim().min(2).describe("search term")).min(1);

/** Exit code for configuration errors (EX_CONFIG, sysexits.h) */
export const EXIT_CONFIG_ERROR = 78;

const FREE_MODELS = [
  "gemini-4-hydrogen",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

/**
 * Returns the search terms file path for the given mode.
 * @param {boolean} mobile
 * @returns {string}
 */
export function getSearchTermsPath(mobile) {
  const suffix = mobile ? "mobile" : "desktop";
  return join(GENERATED_DIR, `search-terms-${suffix}.json`);
}

/**
 * Returns the rolling term history file path for the given mode.
 * @param {boolean} mobile
 * @returns {string}
 */
export function getTermHistoryPath(mobile) {
  const suffix = mobile ? "mobile" : "desktop";
  return join(GENERATED_DIR, `search-history-${suffix}.json`);
}

/**
 * Returns the raw response debug file path for the given mode.
 * @param {boolean} mobile
 * @returns {string}
 */
export function getRawResponsePath(mobile) {
  const suffix = mobile ? "mobile" : "desktop";
  return join(GENERATED_DIR, `raw-response-${suffix}.txt`);
}

/**
 * Resolves how many search terms to ask Gemini for.
 * Falls back to `defaultTermCount` when `maxSearches` is 0 (unlimited).
 *
 * @param {number} maxSearches
 * @param {number} [defaultTermCount]
 * @returns {number}
 */
export function resolveTermCount(maxSearches, defaultTermCount = config.defaultTermCount) {
  return maxSearches > 0 ? maxSearches : defaultTermCount;
}

/**
 * Normalizes a search term for case-insensitive deduplication.
 * @param {string} term
 * @returns {string}
 */
export function normalizeTerm(term) {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Parses a raw JSON model response, validates against `SearchTermsSchema`,
 * and removes internal duplicates as well as terms present in `previousTerms`.
 *
 * @param {string} rawText
 * @param {string[]} [previousTerms]
 * @returns {{ ok: true, terms: string[] } | { ok: false, error: string }}
 */
export function parseAndFilterTerms(rawText, previousTerms = []) {
  /** @type {unknown} */
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Invalid JSON response: ${message}` };
  }

  const schemaResult = SearchTermsSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    return { ok: false, error: `Schema validation failed: ${z.prettifyError(schemaResult.error)}` };
  }

  const seen = new Set(previousTerms.map(normalizeTerm));
  /** @type {string[]} */
  const uniqueTerms = [];

  for (const term of schemaResult.data) {
    const key = normalizeTerm(term);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTerms.push(term);
    }
  }

  if (uniqueTerms.length === 0) {
    return { ok: false, error: "All generated terms were duplicates of previous terms" };
  }

  return { ok: true, terms: uniqueTerms };
}

/**
 * Merges newly generated terms into a rolling deduplicated history capped at `limit`.
 *
 * @param {string[]} existingHistory
 * @param {string[]} newTerms
 * @param {number} [limit]
 * @returns {string[]}
 */
export function mergeTermHistory(existingHistory, newTerms, limit = config.termHistoryLimit) {
  if (limit <= 0) {
    return [];
  }

  /** @type {Map<string, string>} */
  const ordered = new Map();
  for (const term of [...existingHistory, ...newTerms]) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    const key = normalizeTerm(trimmed);
    ordered.delete(key);
    ordered.set(key, trimmed);
  }

  const allTerms = Array.from(ordered.values());
  return allTerms.length > limit ? allTerms.slice(allTerms.length - limit) : allTerms;
}

/**
 * Thrown when no Gemini API key is present in the environment.
 *
 * The @google/genai SDK only warns about a missing key and then falls back to
 * Application Default Credentials, which fails much later with a confusing
 * "Could not load the default credentials" error. We stop before that happens.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set.\n\n" +
        "  A Google Gemini API key is required to generate search terms.\n" +
        "  1. Create a key at https://aistudio.google.com/apikey\n" +
        "  2. Export it before running the app:\n" +
        '       export GEMINI_API_KEY="your-key-here"\n' +
        "  3. To persist it, add that line to ~/.bashrc (or ~/.zshrc) and reopen the shell."
    );
    this.name = "MissingApiKeyError";
  }
}

/**
 * Safely reads a JSON string array from disk, returning an empty array if missing/invalid.
 * @param {string} filePath
 * @returns {Promise<string[]>}
 */
async function readTermsFileIfValid(filePath) {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = SearchTermsSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Generates search terms using the Gemini API and saves them to a JSON file.
 *
 * @param {{ mobile?: boolean, cfg?: import("./config.js").AppConfig }} [options]
 * @returns {Promise<boolean>} True when terms were generated and written
 * @throws {MissingApiKeyError} When no Gemini API key is configured
 */
export async function generateTerms(options = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const mobile = options.mobile ?? isMobileMode();
  const cfg = options.cfg ?? config;

  await mkdir(GENERATED_DIR, { recursive: true });

  const termsPath = getSearchTermsPath(mobile);
  const historyPath = getTermHistoryPath(mobile);
  const rawResponsePath = getRawResponsePath(mobile);

  // Load rolling history (plus last generated file for backwards compatibility)
  const [storedHistory, lastTerms] = await Promise.all([
    readTermsFileIfValid(historyPath),
    readTermsFileIfValid(termsPath),
  ]);
  const previousTerms = mergeTermHistory(storedHistory, lastTerms, cfg.termHistoryLimit);

  const jsonSchema = SearchTermsSchema.toJSONSchema();
  const targetCount = resolveTermCount(getMaxSearches(cfg, mobile), cfg.defaultTermCount);
  const modeLabel = mobile ? "Mobile" : "Desktop";

  console.log(`Generating ${targetCount} search terms for ${modeLabel} mode (${cfg.searchLanguage})...`);
  if (previousTerms.length > 0) {
    console.log(`→ ${previousTerms.length} previous terms loaded — new terms will be different.`);
  }

  const ai = new GoogleGenAI({ apiKey });

  const previousTermsBlock =
    previousTerms.length > 0
      ? `\n\n  IMPORTANT: Do NOT repeat any of the following previously used terms (or very similar variations):\n  ${JSON.stringify(previousTerms)}`
      : "";

  const prompt = `Generate ${targetCount} realistic search terms in ${cfg.searchLanguage} that a typical user might search for on a search engine.

  Requirements:
  - Each term should be something a real person would genuinely search for
  - Mix of categories: how-to queries, product/service lookups, factual questions, recipes, health tips, entertainment, sports, technology, travel destinations, and everyday curiosities
  - Terms should be natural and varied in length
  - Avoid speculative, fictional, or made-up topics
  - Do NOT include years or dates in the search terms
  - Focus on evergreen and practical topics that are always relevant${previousTermsBlock}

  Return as a JSON array of strings.`;

  /** @type {string[] | null} */
  let validatedTerms = null;

  for (const model of FREE_MODELS) {
    try {
      console.log(`Trying model: ${model}...`);

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        console.error(`No response text received from model ${model}, trying next...`);
        continue;
      }

      await writeFile(rawResponsePath, responseText, "utf-8");

      const parsed = parseAndFilterTerms(responseText, previousTerms);
      if (!parsed.ok) {
        console.error(`Invalid response from model ${model} (${parsed.error}), trying next...`);
        continue;
      }

      console.log(`Successfully got ${parsed.terms.length} valid terms from model: ${model}`);
      validatedTerms = parsed.terms;
      break;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const jsonError = parseJSON(errorMessage);
      if (typeof jsonError === "object" && jsonError !== null) {
        console.error(`Error with model ${model}:`, JSON.stringify(jsonError, null, 2));
      } else {
        console.error(`Error with model ${model}:`, errorMessage);
      }
    }
  }

  if (!validatedTerms) {
    console.error("All models failed to generate valid search terms");
    return false;
  }

  const serializedTerms = `${JSON.stringify(validatedTerms, null, 2)}\n`;
  const updatedHistory = mergeTermHistory(previousTerms, validatedTerms, cfg.termHistoryLimit);

  console.log("Generated search terms:");
  console.log(serializedTerms.trimEnd());

  await Promise.all([
    writeFile(termsPath, serializedTerms, "utf-8"),
    writeFile(historyPath, `${JSON.stringify(updatedHistory, null, 2)}\n`, "utf-8"),
  ]);

  return true;
}

/**
 * Attempts to parse a JSON string, falling back to the original text.
 * @param {string} text
 * @returns {unknown}
 */
function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Checks whether this file is being executed directly as a CLI script.
 * @returns {Promise<boolean>}
 */
async function isDirectExecution() {
  const entry = process.argv[1];
  if (!entry) return false;

  const currentFile = fileURLToPath(import.meta.url);
  try {
    const [entryReal, currentReal] = await Promise.all([realpath(resolve(entry)), realpath(currentFile)]);
    return entryReal === currentReal;
  } catch {
    return resolve(entry) === currentFile;
  }
}

if (await isDirectExecution()) {
  try {
    const generated = await generateTerms();
    if (!generated) {
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      console.error(`\n✗ ${error.message}\n`);
      process.exit(EXIT_CONFIG_ERROR);
    }
    throw error;
  }
}
