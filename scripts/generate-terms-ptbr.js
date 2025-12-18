#!/usr/bin/env node

/**
 * Script to generate random search terms in Brazilian Portuguese and update config.js
 * Run with: node scripts/generate-terms-ptbr.js
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "../src/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base word categories in PT-BR to combine for search terms
const wordBases = {
  adjectives: [
    "melhores",
    "principais",
    "últimas",
    "novas",
    "populares",
    "incríveis",
    "fáceis",
    "rápidas",
    "simples",
    "gratuitas",
    "baratas",
    "acessíveis",
    "profissionais",
    "iniciantes",
    "avançadas",
    "modernas",
    "clássicas",
    "tradicionais",
    "inovadoras",
    "criativas",
    "saudáveis",
    "deliciosas",
    "bonitas",
    "impressionantes",
    "emocionantes",
    "interessantes",
    "úteis",
    "práticas",
    "essenciais",
    "importantes",
  ],
  topics: [
    "receitas",
    "dicas",
    "ideias",
    "tendências",
    "notícias",
    "avaliações",
    "guia",
    "tutorial",
    "truques",
    "macetes",
    "segredos",
    "métodos",
    "técnicas",
    "estratégias",
    "soluções",
    "benefícios",
    "curiosidades",
    "história",
    "histórias",
    "exemplos",
  ],
  subjects: [
    "culinária",
    "viagem",
    "fitness",
    "fotografia",
    "jardinagem",
    "música",
    "filmes",
    "livros",
    "jogos",
    "esportes",
    "tecnologia",
    "moda",
    "arte",
    "design",
    "arquitetura",
    "ciência",
    "natureza",
    "animais",
    "carros",
    "motos",
    "camping",
    "trilhas",
    "ciclismo",
    "natação",
    "corrida",
    "yoga",
    "meditação",
    "pintura",
    "desenho",
    "artesanato",
    "marcenaria",
    "eletrônica",
    "programação",
    "marketing",
    "negócios",
    "finanças",
    "investimentos",
    "criptomoedas",
    "imóveis",
    "decoração",
  ],
  timeframes: [
    "2025",
    "hoje",
    "esta semana",
    "este ano",
    "inverno",
    "verão",
    "primavera",
    "outono",
    "fim de semana",
    "feriado",
  ],
  actions: [
    "como fazer",
    "maneiras de",
    "aprender",
    "descobrir",
    "explorar",
    "encontrar",
    "entender",
    "melhorar",
    "dominar",
    "começar",
  ],
  places: [
    "em casa",
    "ao ar livre",
    "praia",
    "montanha",
    "cidade",
    "campo",
    "Europa",
    "Ásia",
    "Brasil",
    "local",
    "São Paulo",
    "Rio de Janeiro",
    "Nordeste",
    "Sul do Brasil",
  ],
  extras: [
    "para iniciantes",
    "para especialistas",
    "para crianças",
    "para adultos",
    "para famílias",
    "com pouco dinheiro",
    "sem equipamento",
    "em casa",
    "online",
    "passo a passo",
    "do zero",
    "rápido e fácil",
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

console.log(`Gerando ${TERM_COUNT} termos de busca aleatórios em PT-BR...\n`);

const searchTerms = generateSearchTerms(TERM_COUNT);

console.log("Termos gerados:");
searchTerms.forEach((term, index) => {
  console.log(`  ${index + 1}. ${term}`);
});

updateConfigFile(searchTerms);

console.log(`\n✓ config.js atualizado com ${searchTerms.length} termos de busca!`);
