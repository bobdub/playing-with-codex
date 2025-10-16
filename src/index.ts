#!/usr/bin/env node
import { readFileSync, statSync, readdirSync, writeFileSync } from 'fs';
import { resolve, join, basename } from 'path';
import { compilePsiSource } from './compiler';
import { CompilationResult, CompiledStatement } from './ast';

type OutputFormat = 'json' | 'summary';

interface CliOptions {
  format: OutputFormat;
  pretty: boolean;
  outFile?: string;
}

interface FileCompilation {
  file: string;
  result: CompilationResult;
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

  const results = files.map<FileCompilation>((file) => ({
    file,
    result: compilePsiSource(readFileSync(file, 'utf8')),
  }));

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
        if (value !== 'json' && value !== 'summary') {
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

  const payload = results.length === 1
    ? formatSingleResult(results[0])
    : results.map((item) => formatSingleResult(item));

  return JSON.stringify(payload, null, options.pretty ? 2 : undefined) + '\n';
}

function formatSingleResult({ file, result }: FileCompilation): object {
  return {
    file,
    ast: result.ast,
    compiled: result.compiled,
  };
}

function renderSummary(results: FileCompilation[]): string {
  const sections = results.map((item) => renderFileSummary(item));
  return `${sections.join('\n\n')}\n`;
}

function renderFileSummary({ file, result }: FileCompilation): string {
  const statementCount = result.compiled.length;
  const prefixed = result.compiled.filter((statement) => statement.prefix).length;
  const psiHeads = result.compiled.filter((statement) => statement.head.kind === 'PsiSymbol').length;
  const lines: string[] = [];
  lines.push(`${file}`);
  lines.push(`  statements: ${statementCount}`);
  lines.push(`  prefixed: ${prefixed}`);
  lines.push(`  psi_heads: ${psiHeads}`);

  const preview = result.compiled
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

function printUsage(): void {
  const usage = `psi-compiler <input...> [options]

Options:
  --format <json|summary>  Output format (default: json)
  --pretty                Pretty-print JSON output
  --no-pretty             Disable pretty printing
  --out <file>            Write output to a file
  -h, --help              Show this help message
`;
  process.stdout.write(usage);
}

run();
