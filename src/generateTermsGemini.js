import { GoogleGenAI } from "@google/genai";
import { writeFile, unlink } from "node:fs/promises";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import * as z from "zod";

// Get the directory of this script
const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");
export const SEARCH_TERMS_PATH = join(__dirname, "generated", "search-terms.json");
const RAW_RESPONSE_PATH = join(__dirname, "generated", "rawResponse.txt");

// json schema for validation
const SearchTermsSchema = z.array(z.string().describe("search term"));
const jsonSchema = SearchTermsSchema.toJSONSchema();

writeFileSync(join(__dirname, "jsonSchema.json"), JSON.stringify(jsonSchema, null, 2));

const currentYear = new Date().getFullYear();

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({});
await main();

async function main() {
  if (!existsSync(GENERATED_DIR)) {
    mkdirSync(GENERATED_DIR);
  }

  if (existsSync(SEARCH_TERMS_PATH)) {
    await unlink(SEARCH_TERMS_PATH);
  }

  if (existsSync(RAW_RESPONSE_PATH)) {
    await unlink(RAW_RESPONSE_PATH);
  }

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

  await writeFile(SEARCH_TERMS_PATH, JSON.stringify(schemaResult.data, null, 2));
  // const searchTerms = extractArrayFromResponse(responseText);

  // if (searchTerms) {
  //   await writeFile(SEARCH_TERMS_PATH, JSON.stringify(searchTerms, null, 2));
  //   console.log("Search terms saved to search-terms.json");
  // } else {
  //   console.error("Could not extract array from response");
  // }
}

// /**
//  * Extracts a JSON array of strings from a text response.
//  * @param {string} text - The text containing the array.
//  * @returns {string[] | null} - The extracted array or null if not found.
//  */
// function extractArrayFromResponse(text) {
//   // Regex to capture a JSON array of strings
//   const arrayRegex = /\[[\s\S]*?\]/;
//   const match = text.match(arrayRegex);

//   if (match) {
//     try {
//       return JSON.parse(match[0]);
//     } catch (error) {
//       console.error("Failed to parse array:", error);
//       return null;
//     }
//   }
//   return null;
// }
