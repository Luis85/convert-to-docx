import { TextRun } from 'docx';
import type Token from 'markdown-it/lib/token.mjs';


export class InlineFormatter {
  /**
   * Walk a markdown-it `inline` token's children to
   * produce an array of TextRun with bold/italic flags.
   */
  public static format(children: Token[]): TextRun[] {
    const runs: TextRun[] = [];
    let isBold = false;
    let isItalic = false;
    let isCode = false;

    for (const child of children) {
      switch (child.type) {
        case 'code_inline':
          // Inline-Code in Monospace
          runs.push(
            new TextRun({
              text: child.content,
              font: 'Courier New',
            })
          );
          break;
        case 'strong_open':
          isBold = true;
          break;
        case 'strong_close':
          isBold = false;
          break;
        case 'em_open':
          isItalic = true;
          break;
        case 'em_close':
          isItalic = false;
          break;
        case 'softbreak':
        case 'hardbreak':
          // Zeilenumbruch
          runs.push(new TextRun({ text: '\n' }));
          break;
        case 'text':
          runs.push(
            new TextRun({
              text: child.content,
              bold: isBold,
              italics: isItalic,
            })
          );
          break;
      }
    }

    return runs;
  }
}
