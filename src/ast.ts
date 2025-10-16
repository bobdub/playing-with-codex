export interface Program {
  type: 'Program';
  statements: Statement[];
}

export interface Statement {
  type: 'Statement';
  prefix: boolean;
  head: ExpressionNode;
  value?: ValueNode;
}

export type ValueNode = BlockNode | ListNode | ExpressionNode;

export interface BlockNode {
  type: 'Block';
  statements: Statement[];
}

export interface ListNode {
  type: 'List';
  items: ExpressionNode[];
}

export interface ExpressionNode {
  type: 'Expression';
  text: string;
}

export interface PsiSymbolInfo {
  kind: 'PsiSymbol';
  raw: string;
  inner: string;
  identifier: string;
  segments: string[];
}

export interface TextExpressionInfo {
  kind: 'Text';
  text: string;
}

export type ExpressionInfo = PsiSymbolInfo | TextExpressionInfo;

export interface CompiledStatement {
  prefix: boolean;
  head: ExpressionInfo;
  value?: CompiledValue;
}

export type CompiledValue =
  | { type: 'Block'; statements: CompiledStatement[] }
  | { type: 'List'; items: ExpressionInfo[] }
  | ExpressionInfo;

export interface CompilationResult {
  source: string;
  ast: Program;
  compiled: CompiledStatement[];
}
