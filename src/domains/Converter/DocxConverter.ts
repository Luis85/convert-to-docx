import MarkdownIt from 'markdown-it';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import type { TFile, Vault } from 'obsidian';
import { InlineFormatter } from './InlineFormatter';
import {
  FileExistsError,
  InvalidMarkdownError,
  ConversionError,
} from '../Errors/ConversionErrors';
import type Token from 'markdown-it/lib/token.mjs';

/**
 * Service to convert Markdown files into DOCX documents.
 */
export class DocxConverter {
  /**
   * Public entry: read, convert, and write.
   * @param overwrite Skip existence check if true.
   */
  public static async convertFile(
    file: TFile,
    vault: Vault,
    overwrite = false
  ): Promise<string> {
    const target = this.computeTargetPath(file);

    await this.guardOverwrite(target, vault, overwrite);

    const mdContent = await this.readMarkdown(file, vault);
    const buffer = await this.buildDocBuffer(mdContent);

    await this.writeDocx(target, buffer, vault);
    return target;
  }

  /** Compute a robust target path ending in .docx */
  private static computeTargetPath(file: TFile): string {
    // Remove last "." + extension from path
    const extLength = file.extension.length + 1;
    const base = file.path.slice(0, -extLength);
    return `${base}.docx`;
  }

  /** Throw FileExistsError if target exists and overwrite is false */
  private static async guardOverwrite(
    target: string,
    vault: Vault,
    overwrite: boolean
  ): Promise<void> {
    if (overwrite) {
      return;
    }
    try {
      if (await vault.adapter.exists(target)) {
        throw new FileExistsError(target);
      }
    } catch (err) {
      if (err instanceof FileExistsError) {
        throw err;
      }
      throw new ConversionError(
        `Error checking existing file: ${(err as Error).message}`
      );
    }
  }

  /** Read the markdown content from vault or throw ConversionError */
  private static async readMarkdown(
    file: TFile,
    vault: Vault
  ): Promise<string> {
    try {
      return await vault.read(file);
    } catch (err) {
      throw new ConversionError(
        `Failed to read source Markdown: ${(err as Error).message}`
      );
    }
  }

  /** Convert markdown content into a DOCX ArrayBuffer */
  private static async buildDocBuffer(
    mdContent: string
  ): Promise<ArrayBuffer> {
    let tokens: Token[];
    try {
      const md = new MarkdownIt();
      tokens = md.parse(mdContent, {});
    } catch (err) {
      throw new InvalidMarkdownError(
        `Markdown parsing failed: ${(err as Error).message}`
      );
    }

    const headingMap = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    } as const;

    const children: Paragraph[] = [];
    let currentLevel: 1 | 2 | 3 | 4 | 5 | 6 | undefined;

    // Collect unique unhandled token types
    const unhandledTypes = new Set<string>();

    for (const token of tokens) {
      switch (token.type) {
        case 'heading_open':
          currentLevel = Number(token.tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
          break;

        case 'inline': {
          const runs = InlineFormatter.format(token.children as Token[]);
          children.push(
            new Paragraph({
              heading: currentLevel ? headingMap[currentLevel] : undefined,
              children: runs,
            })
          );
          currentLevel = undefined;
          break;
        }

        // skip closing tokens silently
        case 'heading_close':
          break;

        default:
          unhandledTypes.add(token.type);
      }
    }
    
    if (unhandledTypes.size > 0) {
      console.warn(`[DocxConverter] Unhandled markdown token types:`);
      console.log(Array.from(unhandledTypes).join(', '));
      console.table(unhandledTypes)
    }

    try {
      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);
      return Uint8Array.from(buffer).buffer;
    } catch (err) {
      throw new ConversionError(
        `DOCX generation failed: ${(err as Error).message}`
      );
    }
  }

  /** Write the ArrayBuffer to the vault, overwriting if allowed */
  private static async writeDocx(
    target: string,
    buffer: ArrayBuffer,
    vault: Vault
  ): Promise<void> {
    try {
      await vault.adapter.writeBinary(target, buffer);
    } catch (err) {
      throw new ConversionError(
        `Failed to write DOCX file: ${(err as Error).message}`
      );
    }
  }
}
