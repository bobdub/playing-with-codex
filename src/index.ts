#!/usr/bin/env node
import { readFileSync, statSync, readdirSync, writeFileSync } from 'fs';
import { resolve, join, basename, relative } from 'path';
import { compilePsiSource } from './compiler';
import { CompilationResult, CompiledStatement, CompiledValue, ExpressionInfo } from './ast';

type OutputFormat = 'json' | 'summary' | 'index';

interface CliOptions {
  format: OutputFormat;
  pretty: boolean;
  outFile?: string;
  symbol?: string;
}

interface FileCompilation {
  file: string;
  result: CompilationResult;
  compiled: CompiledStatement[];
}

function run(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const { options, inputs } = parseArguments(args);
  if (inputs.length === 0) {
    console.error('No input files or directories were provided.');
    process.exit(1);
  }

  const files = collectPsiFiles(inputs);
  if (files.length === 0) {
    console.error('No |Ψ documents were found in the provided paths.');
    process.exit(1);
  }

  const compiledResults = files.map<FileCompilation>((file) => {
    const result = compilePsiSource(readFileSync(file, 'utf8'));
    return { file, result, compiled: result.compiled };
  });

  const results = applySymbolFilter(compiledResults, options.symbol);

  if (results.length === 0) {
    console.error('No statements matched the provided symbol query.');
    process.exit(1);
  }

  const output = renderOutput(results, options);

  if (options.outFile) {
    writeFileSync(options.outFile, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

function parseArguments(argv: string[]): { options: CliOptions; inputs: string[] } {
  const options: CliOptions = { format: 'json', pretty: false };
  const inputs: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--format': {
        const value = argv[i + 1];
        if (!value) {
          throw new Error('Missing value for --format');
        }
        if (value !== 'json' && value !== 'summary' && value !== 'index') {
          throw new Error(`Unsupported format: ${value}`);
        }
        options.format = value;
        i += 1;
        break;
      }
      case '--pretty':
        options.pretty = true;
        break;
      case '--no-pretty':
        options.pretty = false;
        break;
      case '--out': {
        const value = argv[i + 1];
        if (!value) {
          throw new Error('Missing value for --out');
        }
        options.outFile = resolve(value);
        i += 1;
        break;
      }
      case '--symbol': {
        const value = argv[i + 1];
        if (!value) {
          throw new Error('Missing value for --symbol');
        }
        options.symbol = value;
        i += 1;
        break;
      }
      default:
        inputs.push(resolve(arg));
        break;
    }
  }

  return { options, inputs };
}

function collectPsiFiles(inputs: string[]): string[] {
  const files = new Set<string>();
  for (const input of inputs) {
    gatherPsiFiles(input, files);
  }
  return Array.from(files).sort();
}

function gatherPsiFiles(path: string, accumulator: Set<string>): void {
  let stats: ReturnType<typeof statSync> | undefined;
  try {
    stats = statSync(path);
  } catch (error) {
    console.error(`Unable to access ${path}: ${(error as Error).message}`);
    return;
  }

  if (!stats) {
    return;
  }

  if (stats.isDirectory()) {
    const directoryName = basename(path);
    if (directoryName === 'node_modules' || directoryName === '.git' || directoryName === 'dist') {
      return;
    }
    const entries = readdirSync(path);
    for (const entry of entries) {
      gatherPsiFiles(join(path, entry), accumulator);
    }
    return;
  }

  if (stats.isFile() && isPsiDocument(path)) {
    accumulator.add(path);
  }
}

function isPsiDocument(path: string): boolean {
  return path.endsWith('.|Ψ');
}

function renderOutput(results: FileCompilation[], options: CliOptions): string {
  if (options.format === 'summary') {
    return renderSummary(results);
  }

  if (options.format === 'index') {
    return renderKnowledgeIndex(results, options.pretty);
  }

  const payload = results.length === 1
    ? formatSingleResult(results[0], options)
    : results.map((item) => formatSingleResult(item, options));

  return JSON.stringify(payload, null, options.pretty ? 2 : undefined) + '\n';
}

function formatSingleResult({ file, result, compiled }: FileCompilation, options: CliOptions): object {
  const payload: Record<string, unknown> = {
    file,
    compiled,
  };
  if (!options.symbol) {
    payload.ast = result.ast;
  }
  return payload;
}

function renderSummary(results: FileCompilation[]): string {
  const sections = results.map((item) => renderFileSummary(item));
  return `${sections.join('\n\n')}\n`;
}

function renderFileSummary({ file, compiled }: FileCompilation): string {
  const statementCount = compiled.length;
  const prefixed = compiled.filter((statement) => statement.prefix).length;
  const psiHeads = compiled.filter((statement) => statement.head.kind === 'PsiSymbol').length;
  const lines: string[] = [];
  lines.push(`${file}`);
  lines.push(`  statements: ${statementCount}`);
  lines.push(`  prefixed: ${prefixed}`);
  lines.push(`  psi_heads: ${psiHeads}`);

  const preview = compiled
    .slice(0, 5)
    .map((statement) => formatStatementPreview(statement))
    .filter(Boolean) as string[];
  if (preview.length > 0) {
    lines.push('  preview:');
    for (const line of preview) {
      lines.push(`    - ${line}`);
    }
  }
  return lines.join('\n');
}

function formatStatementPreview(statement: CompiledStatement): string | undefined {
  const head = statement.head;
  if (head.kind === 'PsiSymbol') {
    return head.raw;
  }
  if (head.text.length > 0) {
    return head.text;
  }
  return undefined;
}

function applySymbolFilter(results: FileCompilation[], query: string | undefined): FileCompilation[] {
  if (!query) {
    return results;
  }
  const normalized = query.trim();
  if (!normalized) {
    return results;
  }
  return results
    .map(({ file, result }) => {
      const filtered = filterCompiledStatements(result.compiled, normalized);
      return { file, result, compiled: filtered };
    })
    .filter((item) => item.compiled.length > 0);
}

function filterCompiledStatements(statements: CompiledStatement[], query: string): CompiledStatement[] {
  const filtered: CompiledStatement[] = [];
  for (const statement of statements) {
    const matches = expressionMatchesQuery(statement.head, query);
    let filteredValue: CompiledValue | undefined;
    if (statement.value && isBlockValue(statement.value)) {
      const nested = filterCompiledStatements(statement.value.statements, query);
      if (nested.length > 0) {
        filteredValue = { type: 'Block', statements: nested };
      }
    }

    if (matches || filteredValue) {
      const clone: CompiledStatement = { prefix: statement.prefix, head: statement.head };
      if (statement.value) {
        clone.value = filteredValue ?? statement.value;
      }
      filtered.push(clone);
    }
  }
  return filtered;
}

function expressionMatchesQuery(expression: ExpressionInfo, query: string): boolean {
  if (expression.kind === 'PsiSymbol') {
    const { raw, identifier, inner, segments } = expression;
    if (raw === query || identifier === query || inner === query || segments.includes(query)) {
      return true;
    }
    if (raw.startsWith('|Ψ_')) {
      const decoratedIdentifier = identifier.startsWith('Ψ_') ? identifier : `Ψ_${identifier}`;
      if (decoratedIdentifier === query) {
        return true;
      }
    }
    return false;
  }
  return expression.text === query;
}

function isBlockValue(value: CompiledValue): value is { type: 'Block'; statements: CompiledStatement[] } {
  return typeof (value as { type?: string }).type === 'string' && (value as { type: string }).type === 'Block';
}

function isListValue(value: CompiledValue): value is { type: 'List'; items: ExpressionInfo[] } {
  return typeof (value as { type?: string }).type === 'string' && (value as { type: string }).type === 'List';
}

interface KnowledgeIndexEntry {
  head: {
    raw: string;
    inner: string;
    segments: string[];
  };
  file: string;
  path: string[];
  prefix: boolean;
  valueType?: string;
  valuePreview?: string;
}

interface KnowledgeIndexSymbol {
  identifier: string;
  occurrences: number;
  entries: KnowledgeIndexEntry[];
}

interface KnowledgeIndex {
  files: {
    file: string;
    statements: number;
    psiSymbols: number;
  }[];
  symbols: KnowledgeIndexSymbol[];
}

function renderKnowledgeIndex(results: FileCompilation[], pretty: boolean): string {
  const index = buildKnowledgeIndex(results);
  return JSON.stringify(index, null, pretty ? 2 : undefined) + '\n';
}

function buildKnowledgeIndex(results: FileCompilation[]): KnowledgeIndex {
  const symbols = new Map<string, KnowledgeIndexSymbol>();
  const files: KnowledgeIndex['files'] = [];

  for (const { file, compiled } of results) {
    const relativeFile = relative(process.cwd(), file);
    const psiStatements = collectPsiStatements(compiled, relativeFile);
    files.push({ file: relativeFile, statements: compiled.length, psiSymbols: psiStatements.length });

    for (const entry of psiStatements) {
      const head = entry.statement.head;
      if (head.kind !== 'PsiSymbol') {
        continue;
      }
      const identifier = decorateIdentifier(head.identifier);
      let symbol = symbols.get(identifier);
      if (!symbol) {
        symbol = { identifier, occurrences: 0, entries: [] };
        symbols.set(identifier, symbol);
      }
      symbol.occurrences += 1;
      symbol.entries.push({
        head: {
          raw: head.raw,
          inner: head.inner,
          segments: head.segments.slice(),
        },
        file: entry.file,
        path: entry.path,
        prefix: entry.statement.prefix,
        valueType: describeValueType(entry.statement.value),
        valuePreview: createValuePreview(entry.statement.value),
      });
    }
  }

  const sortedSymbols = Array.from(symbols.values())
    .map((symbol) => ({
      identifier: symbol.identifier,
      occurrences: symbol.occurrences,
      entries: symbol.entries
        .sort((a, b) => {
          if (a.file === b.file) {
            return a.path.join('>').localeCompare(b.path.join('>'));
          }
          return a.file.localeCompare(b.file);
        }),
    }))
    .sort((a, b) => a.identifier.localeCompare(b.identifier));

  return {
    files: files.sort((a, b) => a.file.localeCompare(b.file)),
    symbols: sortedSymbols,
  };
}

function decorateIdentifier(identifier: string): string {
  return identifier.startsWith('Ψ_') ? identifier : `Ψ_${identifier}`;
}

interface PsiStatementEntry {
  file: string;
  path: string[];
  statement: CompiledStatement;
}

function collectPsiStatements(statements: CompiledStatement[], file: string, ancestors: string[] = []): PsiStatementEntry[] {
  const collected: PsiStatementEntry[] = [];
  for (const statement of statements) {
    const label = formatExpressionSummary(statement.head);
    const path = [...ancestors, label];
    if (statement.head.kind === 'PsiSymbol') {
      collected.push({ file, path, statement });
    }
    if (statement.value && isBlockValue(statement.value)) {
      collected.push(...collectPsiStatements(statement.value.statements, file, path));
    }
  }
  return collected;
}

function describeValueType(value: CompiledValue | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (isBlockValue(value)) {
    return 'Block';
  }
  if (isListValue(value)) {
    return 'List';
  }
  if ((value as ExpressionInfo).kind === 'PsiSymbol') {
    return 'PsiSymbol';
  }
  if ((value as ExpressionInfo).kind === 'Text') {
    return 'Text';
  }
  return undefined;
}

function createValuePreview(value: CompiledValue | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (isBlockValue(value)) {
    const previews = value.statements.slice(0, 3).map((statement) => formatExpressionSummary(statement.head));
    const suffix = value.statements.length > 3 ? ' …' : '';
    return `Block(${value.statements.length}): ${previews.join(' | ')}${suffix}`;
  }
  if (isListValue(value)) {
    const items = value.items.slice(0, 5).map((item) => formatExpressionSummary(item));
    const suffix = value.items.length > 5 ? ' …' : '';
    return `List(${value.items.length}): ${items.join(', ')}${suffix}`;
  }
  return formatExpressionSummary(value as ExpressionInfo);
}

function formatExpressionSummary(expression: ExpressionInfo): string {
  if (expression.kind === 'PsiSymbol') {
    return expression.raw;
  }
  return expression.text;
}

function printUsage(): void {
  const usage = `psi-compiler <input...> [options]

Options:
  --format <json|summary|index>  Output format (default: json)
  --pretty                Pretty-print JSON output
  --no-pretty             Disable pretty printing
  --out <file>            Write output to a file
  --symbol <value>        Filter output by matching statement head
  -h, --help              Show this help message
`;
  process.stdout.write(usage);
}

run();
