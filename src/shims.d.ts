declare module 'codeflask' {
  export default class CodeFlask {
    constructor(selectorOrElement: string | Element, opts?: any);
    onUpdate(cb: (code: string) => void): void;
    updateCode(code: string): void;
    getCode(): string;
    addLanguage?(name: string, grammar: any): void;
    updateLanguage?(name: string): void;
  }
}


