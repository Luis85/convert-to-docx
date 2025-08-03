import MarkdownIt from 'markdown-it';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { TFile, Vault } from 'obsidian';
import { InlineFormatter } from './InlineFormatter';
import type Token from 'markdown-it/lib/token.mjs';

/**
 * Service to convert Markdown content into a .docx ArrayBuffer.
 */
export class DocxConverter {
  /**
   * Parses Markdown, builds a Word document, and returns an ArrayBuffer ready to write.
   */
  public static async convert(mdContent: string): Promise<ArrayBuffer> {
    // 1. Tokenize
    const md = new MarkdownIt();
    const tokens = md.parse(mdContent, {});

    // 2. Heading map
    const headingMap = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    } as const;

    // 3. Build paragraphs
    const children: Paragraph[] = [];
    let currentLevel: 1|2|3|4|5|6|undefined;

    for (const token of tokens) {
      if (token.type === 'heading_open') {
        currentLevel = parseInt(token.tag.slice(1), 10) as 1|2|3|4|5|6;
      } else if (token.type === 'inline') {
        const runs = InlineFormatter.format(token.children as Token[]);
        children.push(
          new Paragraph({
            children: runs,
            heading: currentLevel ? headingMap[currentLevel] : undefined,
          })
        );
        currentLevel = undefined;
      }
    }

    // 4. Assemble document
    const doc = new Document({ sections: [{ children }] });

    // 5. Pack to Buffer then extract ArrayBuffer
    const buffer = await Packer.toBuffer(doc);
    return Uint8Array.from(buffer).buffer;
  }

  /**
   * Convenience: read a TFile from vault, convert, and write .docx beside it.
   */
  public static async convertFile(file: TFile, vault: Vault): Promise<string> {
    const md = await vault.read(file);
    const arrayBuffer = await DocxConverter.convert(md);
    const target = file.path.replace(/\.md$/, '.docx');
    await vault.adapter.writeBinary(target, arrayBuffer);
    return target;
  }
}
