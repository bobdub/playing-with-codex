import {
  BlockNode,
  CompilationResult,
  CompiledStatement,
  CompiledValue,
  ExpressionInfo,
  ExpressionNode,
  ListNode,
  Program,
  PsiSymbolInfo,
  Statement,
  ValueNode,
} from './ast';
import { parsePsiDocument } from './parser';

export function compilePsiSource(source: string): CompilationResult {
  const ast = parsePsiDocument(source);
  const compiled = ast.statements.map((statement) => compileStatement(statement));
  return { source, ast, compiled };
}

export function compilePsiProgram(program: Program): CompiledStatement[] {
  return program.statements.map((statement) => compileStatement(statement));
}

function compileStatement(statement: Statement): CompiledStatement {
  const head = compileExpression(statement.head);
  const result: CompiledStatement = { prefix: statement.prefix, head };
  if (statement.value) {
    result.value = compileValue(statement.value);
  }
  return result;
}

function compileValue(value: ValueNode): CompiledValue {
  if (value.type === 'Block') {
    return compileBlock(value);
  }
  if (value.type === 'List') {
    return compileList(value);
  }
  return compileExpression(value);
}

function compileBlock(block: BlockNode): CompiledValue {
  return {
    type: 'Block',
    statements: block.statements.map((statement) => compileStatement(statement)),
  };
}

function compileList(list: ListNode): CompiledValue {
  return {
    type: 'List',
    items: list.items.map((item) => compileExpression(item)),
  };
}

function compileExpression(node: ExpressionNode): ExpressionInfo {
  const trimmed = node.text.trim();
  if (!trimmed) {
    return { kind: 'Text', text: '' };
  }
  const psi = parsePsiSymbol(trimmed);
  if (psi) {
    return psi;
  }
  return { kind: 'Text', text: trimmed };
}

function parsePsiSymbol(text: string): PsiSymbolInfo | null {
  if (!text.startsWith('|Ψ') || !text.endsWith('⟩')) {
    return null;
  }
  const innerWithPrefix = text.slice(2, -1);
  const inner = innerWithPrefix.startsWith('_')
    ? innerWithPrefix.slice(1)
    : innerWithPrefix;
  const segments = splitSegments(inner);
  const identifier = segments.length > 0 ? stripInvocationSuffix(segments[0]) : inner;
  return {
    kind: 'PsiSymbol',
    raw: text,
    inner,
    identifier,
    segments,
  };
}

function stripInvocationSuffix(segment: string): string {
  const openParenIndex = segment.indexOf('(');
  if (openParenIndex === -1) {
    return segment.trim();
  }
  return segment.slice(0, openParenIndex).trim();
}

function splitSegments(value: string): string[] {
  const segments: string[] = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let stringMode: 'single' | 'double' | 'triple' | null = null;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];

    if (stringMode) {
      if (stringMode === 'triple') {
        if (ch === '"' && value[i + 1] === '"' && value[i + 2] === '"') {
          current += ch + value[i + 1] + value[i + 2];
          i += 2;
          stringMode = null;
          continue;
        }
        current += ch;
        continue;
      }
      if (ch === '\\') {
        current += ch;
        if (i + 1 < value.length) {
          current += value[i + 1];
          i += 1;
        }
        continue;
      }
      if ((stringMode === 'double' && ch === '"') || (stringMode === 'single' && ch === '\'')) {
        current += ch;
        stringMode = null;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === '"') {
      if (value[i + 1] === '"' && value[i + 2] === '"') {
        current += ch + value[i + 1] + value[i + 2];
        i += 2;
        stringMode = 'triple';
        continue;
      }
      current += ch;
      stringMode = 'double';
      continue;
    }
    if (ch === '\'') {
      current += ch;
      stringMode = 'single';
      continue;
    }

    if (ch === '(') {
      depthParen += 1;
    } else if (ch === ')') {
      depthParen = Math.max(depthParen - 1, 0);
    } else if (ch === '[') {
      depthBracket += 1;
    } else if (ch === ']') {
      depthBracket = Math.max(depthBracket - 1, 0);
    } else if (ch === '{') {
      depthBrace += 1;
    } else if (ch === '}') {
      depthBrace = Math.max(depthBrace - 1, 0);
    }

    if (ch === '.' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      segments.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  const finalSegment = current.trim();
  if (finalSegment) {
    segments.push(finalSegment);
  }

  return segments;
}

export function expressionToString(info: ExpressionInfo): string {
  if (info.kind === 'PsiSymbol') {
    return info.raw;
  }
  return info.text;
}
