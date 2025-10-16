import { BlockNode, ExpressionNode, ListNode, Program, Statement, ValueNode } from './ast';

const WHITESPACE_REGEX = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

export class PsiParser {
  private readonly length: number;
  private position = 0;

  constructor(private readonly source: string) {
    this.length = source.length;
  }

  parse(): Program {
    const statements = this.parseStatements();
    this.skipWhitespace();
    if (!this.isAtEnd()) {
      throw this.error('Unexpected trailing content.');
    }
    return { type: 'Program', statements };
  }

  private parseStatements(): Statement[] {
    const statements: Statement[] = [];
    while (true) {
      this.skipWhitespace();
      if (this.isAtEnd() || this.peekChar() === '}') {
        break;
      }
      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      }
    }
    return statements;
  }

  private parseStatement(): Statement | undefined {
    this.skipWhitespace();
    if (this.isAtEnd() || this.peekChar() === '}') {
      return undefined;
    }

    let prefix = false;
    if (this.peekChar() === '⊗') {
      prefix = true;
      this.advance();
      this.skipWhitespace();
    }

    const headText = this.readHead();
    if (!headText) {
      return undefined;
    }
    const head: ExpressionNode = { type: 'Expression', text: headText };

    this.skipWhitespace();
    let value: ValueNode | undefined;
    if (this.peekChar() === '=') {
      this.advance();
      this.skipWhitespace();
      value = this.parseValue();
    }

    this.consumeStatementTerminators();

    return {
      type: 'Statement',
      prefix,
      head,
      ...(value ? { value } : {}),
    };
  }

  private parseValue(): ValueNode {
    const ch = this.peekChar();
    if (ch === '{') {
      return this.parseBlock();
    }
    if (ch === '[') {
      return this.parseList();
    }
    const text = this.readExpressionText(new Set([';', ',', '\n', '\r', '}']));
    return { type: 'Expression', text };
  }

  private parseBlock(): BlockNode {
    this.expect('{');
    const statements = this.parseStatements();
    this.skipWhitespace();
    this.expect('}');
    return { type: 'Block', statements };
  }

  private parseList(): ListNode {
    this.expect('[');
    const items: ExpressionNode[] = [];
    while (true) {
      this.skipWhitespace();
      if (this.isAtEnd()) {
        throw this.error('Unexpected end of input inside list.');
      }
      if (this.peekChar() === ']') {
        break;
      }
      const text = this.readExpressionText(new Set([',', ']']));
      items.push({ type: 'Expression', text });
      this.skipWhitespace();
      if (this.peekChar() === ',') {
        this.advance();
      }
    }
    this.expect(']');
    return { type: 'List', items };
  }

  private readHead(): string {
    return this.readExpressionText(new Set(['=', ';', ',', '\n', '\r', '}']));
  }

  private readExpressionText(delimiters: Set<string>): string {
    const start = this.position;
    let depthParen = 0;
    let depthBrace = 0;
    let depthBracket = 0;
    let stringMode: 'single' | 'double' | 'triple' | null = null;

    while (!this.isAtEnd()) {
      const ch = this.peekChar();

      if (stringMode) {
        if (stringMode === 'triple') {
          if (ch === '"' && this.peekChar(1) === '"' && this.peekChar(2) === '"') {
            this.advance(3);
            stringMode = null;
            continue;
          }
          this.advance();
          continue;
        }

        if (ch === '\\') {
          this.advance(2);
          continue;
        }

        if ((stringMode === 'single' && ch === '\'') || (stringMode === 'double' && ch === '"')) {
          this.advance();
          stringMode = null;
          continue;
        }

        this.advance();
        continue;
      }

      if (ch === '(') {
        depthParen++;
        this.advance();
        continue;
      }
      if (ch === ')') {
        if (depthParen === 0 && delimiters.has(ch)) {
          break;
        }
        depthParen = Math.max(depthParen - 1, 0);
        this.advance();
        continue;
      }
      if (ch === '{') {
        depthBrace++;
        this.advance();
        continue;
      }
      if (ch === '}') {
        if (depthBrace === 0 && delimiters.has(ch)) {
          break;
        }
        depthBrace = Math.max(depthBrace - 1, 0);
        this.advance();
        continue;
      }
      if (ch === '[') {
        depthBracket++;
        this.advance();
        continue;
      }
      if (ch === ']') {
        if (depthBracket === 0 && delimiters.has(ch)) {
          break;
        }
        depthBracket = Math.max(depthBracket - 1, 0);
        this.advance();
        continue;
      }
      if (ch === '"') {
        if (this.peekChar(1) === '"' && this.peekChar(2) === '"') {
          this.advance(3);
          stringMode = 'triple';
          continue;
        }
        stringMode = 'double';
        this.advance();
        continue;
      }
      if (ch === '\'') {
        stringMode = 'single';
        this.advance();
        continue;
      }

      if (depthParen === 0 && depthBrace === 0 && depthBracket === 0 && delimiters.has(ch)) {
        break;
      }

      this.advance();
    }

    const text = this.source.slice(start, this.position).trim();
    return text;
  }

  private consumeStatementTerminators(): void {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      const ch = this.peekChar();
      if (ch === ';' || ch === ',') {
        this.advance();
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        this.advance();
        continue;
      }
      break;
    }
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peekChar();
      if (!WHITESPACE_REGEX.test(ch)) {
        break;
      }
      this.advance();
    }
  }

  private expect(char: string): void {
    if (this.peekChar() !== char) {
      throw this.error(`Expected '${char}'.`);
    }
    this.advance();
  }

  private advance(count = 1): void {
    this.position = Math.min(this.position + count, this.length);
  }

  private peekChar(lookahead = 0): string {
    const index = this.position + lookahead;
    if (index >= this.length) {
      return '\0';
    }
    return this.source.charAt(index);
  }

  private isAtEnd(): boolean {
    return this.position >= this.length;
  }

  private error(message: string): Error {
    return new Error(`${message} (at position ${this.position})`);
  }
}

export function parsePsiDocument(source: string): Program {
  const parser = new PsiParser(source);
  return parser.parse();
}
