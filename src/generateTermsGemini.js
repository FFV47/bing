import { GoogleGenAI } from "@google/genai";
import { writeFile, unlink } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of this script
const __dirname = dirname(fileURLToPath(import.meta.url));
const SEARCH_TERMS_PATH = join(__dirname, "search-terms.json");
const RAW_RESPONSE_PATH = join(__dirname, "rawResponse.txt");

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({});
await main();

async function main() {
  if (existsSync(SEARCH_TERMS_PATH)) {
    await unlink(SEARCH_TERMS_PATH);
  }

  if (existsSync(RAW_RESPONSE_PATH)) {
    await unlink(RAW_RESPONSE_PATH);
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Generate 30 search terms for a search engine in Portuguese. Put it all in a array of strings.",
  });

  const responseText = response.text;
  if (!responseText) {
    console.error("No response text received from Gemini API");
    return;
  }
  writeFileSync(RAW_RESPONSE_PATH, responseText);

  const searchTerms = extractArrayFromResponse(responseText);

  if (searchTerms) {
    await writeFile(SEARCH_TERMS_PATH, JSON.stringify(searchTerms, null, 2));
    console.log("Search terms saved to search-terms.json");
  } else {
    console.error("Could not extract array from response");
  }
}

/**
 * Extracts a JSON array of strings from a text response.
 * @param {string} text - The text containing the array.
 * @returns {string[] | null} - The extracted array or null if not found.
 */
function extractArrayFromResponse(text) {
  // Regex to capture a JSON array of strings
  const arrayRegex = /\[[\s\S]*?\]/;
  const match = text.match(arrayRegex);

  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Failed to parse array:", error);
      return null;
    }
  }
  return null;
}
