#!/usr/bin/env node

/**
 * Offline fallback script to generate natural Brazilian Portuguese search terms
 * and write them to `src/generated/search-terms-{desktop|mobile}.json`.
 *
 * Run with:
 *   node scripts/generate-terms-ptbr.js
 *   node scripts/generate-terms-ptbr.js --mobile
 */

import { mkdir, writeFile } from "node:fs/promises";
import { config, getMaxSearches, isMobileMode } from "../src/config.js";
import { GENERATED_DIR, getSearchTermsPath, resolveTermCount } from "../src/generateTermsGemini.js";

const wordBases = {
  recipes: [
    "pão de queijo",
    "bolo de cenoura",
    "panqueca de carne moída",
    "frango xadrez",
    "lasanha à bolonhesa",
    "pudim de leite condensado",
    "risoto de cogumelos",
    "torta de frango",
    "feijão tropeiro",
    "mousse de maracujá",
    "macarrão ao molho branco",
    "escondidinho de carne seca",
  ],
  howToTasks: [
    "organizar finanças pessoais",
    "aprender inglês sozinho",
    "cuidar de plantas em apartamento",
    "fazer um currículo simples",
    "melhorar a qualidade do sono",
    "economizar energia elétrica em casa",
    "limpar tela de notebook",
    "escolher um bom colchão",
    "começar a correr do zero",
    "tirar manchas de roupa branca",
    "trocar a resistência do chuveiro",
    "fazer backup de fotos no celular",
  ],
  studySubjects: [
    "fotografia",
    "jardinagem",
    "programação",
    "culinária",
    "investimentos",
    "marcenaria",
    "design de interiores",
    "corrida de rua",
    "meditação",
    "ciclismo",
    "eletrônica básica",
    "desenho artístico",
  ],
  destinations: [
    "Florianópolis",
    "Gramado",
    "Rio de Janeiro",
    "Curitiba",
    "Ouro Preto",
    "Salvador",
    "Recife",
    "Belo Horizonte",
    "Campos do Jordão",
    "Bonito",
    "Foz do Iguaçu",
    "Maceió",
  ],
  curiosities: [
    "por que o céu é azul",
    "como funciona o micro-ondas",
    "benefícios de beber água em jejum",
    "alimentos ricos em vitamina D",
    "quanto tempo o café dura na geladeira",
    "diferença entre café arábica e robusta",
    "como surgiu o cinema",
    "qual a origem do idioma português",
    "como funcionam os painéis solares",
    "por que bocejamos",
  ],
  audiences: ["para iniciantes", "em casa", "gastando pouco", "passo a passo", "do zero"],
};

const templates = [
  () => `receita fácil de ${pick(wordBases.recipes)}`,
  () => `como fazer ${pick(wordBases.recipes)} caseiro`,
  () => `como ${pick(wordBases.howToTasks)}`,
  () => `dicas de ${pick(wordBases.studySubjects)} ${pick(wordBases.audiences)}`,
  () => `guia de ${pick(wordBases.studySubjects)} ${pick(wordBases.audiences)}`,
  () => `o que fazer em ${pick(wordBases.destinations)}`,
  () => `melhores passeios em ${pick(wordBases.destinations)}`,
  () => `roteiro de fim de semana em ${pick(wordBases.destinations)}`,
  () => pick(wordBases.curiosities),
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
 * Generates unique random search terms in Brazilian Portuguese.
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

console.log(`Gerando ${termCount} termos de busca offline em PT-BR (${modeLabel})...\n`);

const searchTerms = generateSearchTerms(termCount);

console.log("Termos gerados:");
searchTerms.forEach((term, index) => {
  console.log(`  ${index + 1}. ${term}`);
});

await mkdir(GENERATED_DIR, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(searchTerms, null, 2)}\n`, "utf-8");

console.log(`\n✓ ${searchTerms.length} termos salvos em ${outputPath}`);
