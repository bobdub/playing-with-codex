#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const cliPath = resolve(__dirname, '..', 'dist', 'index.js');
const ethicsDocument = resolve(__dirname, '..', 'docs', 'Ethics.|Ψ');

const execution = spawnSync('node', [cliPath, ethicsDocument, '--no-pretty'], {
  encoding: 'utf8',
});

if (execution.status !== 0) {
  console.error('Failed to execute psi-compiler for ethics validation.');
  if (execution.error) {
    console.error(execution.error);
  }
  if (execution.stderr) {
    console.error(execution.stderr.trim());
  }
  process.exit(execution.status ?? 1);
}

let payload;
try {
  payload = JSON.parse(execution.stdout);
} catch (error) {
  console.error('Unable to parse psi-compiler output for ethics validation.');
  console.error(error);
  process.exit(1);
}

const flattenStatements = (statements) => {
  const collected = [];
  for (const statement of statements) {
    collected.push(statement);
    if (statement.value && statement.value.type === 'Block') {
      collected.push(...flattenStatements(statement.value.statements));
    }
  }
  return collected;
};

const statements = flattenStatements(payload.compiled ?? []);

const directive = statements.find((statement) => {
  return statement.head?.kind === 'PsiSymbol' && statement.head.raw === '|Ψ_Agent("Ethics").Directive⟩';
});

if (!directive) {
  console.error('Ethics charter is missing the directive statement.');
  process.exit(1);
}

const directiveText = extractExpressionText(directive.value);
if (!directiveText || directiveText.trim().length === 0) {
  console.error('Ethics directive must include descriptive guidance.');
  process.exit(1);
}

const resultBranch = statements.find((statement) => {
  return statement.head?.kind === 'PsiSymbol' && statement.head.raw === '|Ψ_Result⟩';
});

if (!resultBranch || !resultBranch.value || resultBranch.value.kind !== 'Text') {
  console.error('Ethics charter must define the decision branch with explicit outcomes.');
  process.exit(1);
}

const branchText = resultBranch.value.text;
const requiredOutcomes = [
  '|Ψ_Ethics(reject).state⟩',
  '|Ψ_Ethics(reflect).state⟩',
  '|Ψ_Ethics(approve).state⟩',
];

const missing = requiredOutcomes.filter((token) => !branchText.includes(token));
if (missing.length > 0) {
  console.error('Ethics decision branch is missing required outcomes:');
  for (const outcome of missing) {
    console.error(` - ${outcome}`);
  }
  process.exit(1);
}

console.log('Ethics charter validation passed.');

function extractExpressionText(value) {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'object' && value !== null) {
    if (value.kind === 'Text') {
      return value.text;
    }
    if (value.kind === 'PsiSymbol') {
      return value.raw;
    }
  }
  return undefined;
}
