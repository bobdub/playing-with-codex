#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const cliPath = resolve(__dirname, '..', 'dist', 'index.js');
const documentPath = resolve(__dirname, '..', 'docs', 'Bootloader.|Ψ');

const result = spawnSync('node', [cliPath, documentPath, '--symbol', 'Ψ_Network'], {
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error('Failed to execute psi-compiler for regression check.');
  if (result.error) {
    console.error(result.error);
  }
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
  process.exit(result.status ?? 1);
}

let payload;
try {
  payload = JSON.parse(result.stdout);
} catch (error) {
  console.error('Unable to parse psi-compiler output as JSON.');
  console.error(error);
  process.exit(1);
}

const collectCompiled = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectCompiled(item));
  }
  if (value && Array.isArray(value.compiled)) {
    return value.compiled;
  }
  return [];
};

const compiledStatements = collectCompiled(payload);

if (compiledStatements.length === 0) {
  console.error('No statements were returned for Ψ_Network; regression detected.');
  process.exit(1);
}

const invalidStatements = compiledStatements.filter((statement) => {
  return statement.head?.kind !== 'PsiSymbol' || !statement.head.raw.startsWith('|Ψ_Network');
});

if (invalidStatements.length > 0) {
  console.error('Unexpected statements found when filtering for Ψ_Network:');
  for (const statement of invalidStatements) {
    console.error(` - ${JSON.stringify(statement.head)}`);
  }
  process.exit(1);
}

console.log('Symbol filter regression check passed.');
