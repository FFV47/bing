import { GoogleGenAI } from "@google/genai";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { config } from "./config.js";

// Use a directory relative to current working directory for portability
const GENERATED_DIR = join(process.cwd(), "generated");

export const SEARCH_TERMS_PATH = join(GENERATED_DIR, "search-terms.json");
const RAW_RESPONSE_PATH = join(GENERATED_DIR, "rawResponse.txt");

// Run only when executed directly (e.g., `node generateTermsGemini.js`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateTerms();
}

/**
 * Generates search terms using the Gemini API and saves them to a JSON file.
 */
export async function generateTerms() {
  if (!existsSync(GENERATED_DIR)) {
    mkdirSync(GENERATED_DIR);
  }

  if (existsSync(SEARCH_TERMS_PATH)) {
    await unlink(SEARCH_TERMS_PATH);
  }

  if (existsSync(RAW_RESPONSE_PATH)) {
    await unlink(RAW_RESPONSE_PATH);
  }

  // json schema for validation
  const SearchTermsSchema = z.array(z.string().describe("search term"));
  const jsonSchema = SearchTermsSchema.toJSONSchema();

  const currentYear = new Date().getFullYear();

  // The client gets the API key from the environment variable `GEMINI_API_KEY`.
  const ai = new GoogleGenAI({});

  const prompt = `Generate ${config.maxSearches} search terms for a search engine in Portuguese. If possible generate these terms based on google search trending topics for ${currentYear} or after. Put it all in a array of strings.`;

  const response = await ai.models.generateContent({
    "model": "gemini-3-flash-preview",
    "contents": prompt,
    "config": {
      "responseMimeType": "application/json",
      "responseJsonSchema": jsonSchema,
    },
  });

  const responseText = response.text;
  if (!responseText) {
    console.error("No response text received from Gemini API");
    return;
  }

  writeFileSync(RAW_RESPONSE_PATH, responseText);

  const schemaResult = SearchTermsSchema.safeParse(JSON.parse(responseText));
  if (!schemaResult.success) {
    console.error("Response validation failed:", schemaResult.error);
    return;
  }

  const searchTerms = JSON.stringify(schemaResult.data, null, 2);

  console.log("Generated search terms:");
  console.log(searchTerms);
  await writeFile(SEARCH_TERMS_PATH, searchTerms);
}
