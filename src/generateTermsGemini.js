import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { getGeminiApiKey, getMaxSearches, isMobileMode } from "./config.js";

// Get the directory of this script
const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");

/**
 * Returns the search terms file path for the given mode.
 * @param {boolean} mobile
 */
export function getSearchTermsPath(mobile) {
  const suffix = mobile ? "mobile" : "desktop";
  return join(GENERATED_DIR, `search-terms-${suffix}.json`);
}

export const SEARCH_TERMS_PATH = getSearchTermsPath(isMobileMode());
const RAW_RESPONSE_PATH = join(GENERATED_DIR, "rawResponse.txt");

/** Exit code for configuration errors (EX_CONFIG, sysexits.h) */
export const EXIT_CONFIG_ERROR = 78;

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
        "  3. To persist it, add that line to ~/.bashrc (or ~/.zshrc) and reopen the shell.",
    );
    this.name = "MissingApiKeyError";
  }
}

// Run only when executed directly (e.g., `node generateTermsGemini.js`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
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

/**
 * Generates search terms using the Gemini API and saves them to a JSON file.
 *
 * @returns {Promise<boolean>} True when terms were generated and written
 * @throws {MissingApiKeyError} When no Gemini API key is configured
 */
export async function generateTerms() {
  // Validate configuration before touching the filesystem or the network.
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  if (!existsSync(GENERATED_DIR)) {
    mkdirSync(GENERATED_DIR);
  }

  const termsPath = getSearchTermsPath(isMobileMode());

  // Load last generated terms (if any) to avoid duplicates
  let lastTerms = [];
  if (existsSync(termsPath)) {
    try {
      lastTerms = JSON.parse(readFileSync(termsPath, "utf-8"));
      if (!Array.isArray(lastTerms)) lastTerms = [];
    } catch {
      lastTerms = [];
    }
  }

  // json schema for validation
  const SearchTermsSchema = z.array(z.string().describe("search term"));
  const jsonSchema = SearchTermsSchema.toJSONSchema();

  const maxSearches = getMaxSearches();
  const modeLabel = isMobileMode() ? "Mobile" : "Desktop";

  console.log(`Generating ${maxSearches} search terms for ${modeLabel} mode...`);
  if (lastTerms.length > 0) {
    console.log(`→ ${lastTerms.length} previous terms loaded — new terms will be different.`);
  }

  const ai = new GoogleGenAI({ apiKey });

  const lastTermsBlock =
    lastTerms.length > 0
      ? `\n\n  IMPORTANT: Do NOT repeat any of the following previously used terms (or very similar variations):\n  ${JSON.stringify(lastTerms)}`
      : "";

  const prompt = `Generate ${maxSearches} realistic search terms in Brazilian Portuguese that a typical user might search for on a search engine.

  Requirements:
  - Each term should be something a real person would genuinely search for
  - Mix of categories: how-to queries, product/service lookups, factual questions, recipes, health tips, entertainment, sports, technology, travel destinations, and everyday curiosities
  - Terms should be natural and varied in length
  - Avoid speculative, fictional, or made-up topics
  - Do NOT include years or dates in the search terms
  - Focus on evergreen and practical topics that are always relevant${lastTermsBlock}

  Return as a JSON array of strings.`;

  const freeModels = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"];

  let responseText;
  for (const model of freeModels) {
    try {
      console.log(`Trying model: ${model}...`);

      const config = {
        "responseMimeType": "application/json",
        "responseJsonSchema": jsonSchema,
      };

      if (freeModels.includes(model)) {
        config.thinkingConfig = {
          "thinkingLevel": ThinkingLevel.HIGH,
        };
      }

      const response = await ai.models.generateContent({
        "model": model,
        "contents": prompt,
        "config": config,
      });

      responseText = response.text;
      if (!responseText) {
        console.error(`No response text received from model ${model}, trying next...`);
        continue;
      }

      console.log(`Successfully got response from model: ${model}`);
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

  if (!responseText) {
    console.error("All models failed to generate search terms");
    return false;
  }

  writeFileSync(RAW_RESPONSE_PATH, responseText);

  const schemaResult = SearchTermsSchema.safeParse(JSON.parse(responseText));
  if (!schemaResult.success) {
    console.error("Response validation failed:", schemaResult.error);
    return false;
  }

  const searchTerms = JSON.stringify(schemaResult.data, null, 2);

  console.log("Generated search terms:");
  console.log(searchTerms);
  await writeFile(termsPath, searchTerms);

  return true;
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
