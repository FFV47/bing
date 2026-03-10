import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { getMaxSearches, isMobileMode } from "./config.js";

// Get the directory of this script
const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(__dirname, "generated");

export const SEARCH_TERMS_PATH = join(__dirname, "generated", "search-terms.json");
const RAW_RESPONSE_PATH = join(__dirname, "generated", "rawResponse.txt");

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

  const maxSearches = getMaxSearches();
  const modeLabel = isMobileMode() ? "Mobile" : "Desktop";

  console.log(`Generating ${maxSearches} search terms for ${modeLabel} mode...`);

  // The client gets the API key from the environment variable `GEMINI_API_KEY`.
  const ai = new GoogleGenAI({});

  const prompt = `Generate ${maxSearches} realistic search terms in Brazilian Portuguese that a typical user might search for on a search engine.

  Requirements:
  - Each term should be something a real person would genuinely search for
  - Mix of categories: how-to queries, product/service lookups, factual questions, recipes, health tips, entertainment, sports, technology, travel destinations, and everyday curiosities
  - Terms should be natural and varied in length
  - Avoid speculative, fictional, or made-up topics
  - Do NOT include years or dates in the search terms
  - Focus on evergreen and practical topics that are always relevant

  Return as a JSON array of strings.`;

  const freeTierModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const freeTierThinkingModels = ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"];

  const freeModels = [...freeTierThinkingModels, ...freeTierModels];

  let responseText;
  for (const model of freeModels) {
    try {
      console.log(`Trying model: ${model}...`);

      const config = {
        "responseMimeType": "application/json",
        "responseJsonSchema": jsonSchema,
      };

      if (freeTierThinkingModels.includes(model)) {
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

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
