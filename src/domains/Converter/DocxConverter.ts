import MarkdownIt from 'markdown-it';
import {
  Document,
  Packer,
  Paragraph, 
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  SectionType,
} from 'docx';
import type { TFile, Vault } from 'obsidian';
import { InlineFormatter } from './InlineFormatter';
import {
  FileExistsError,
  InvalidMarkdownError,
  ConversionError,
} from '../Errors/ConversionErrors';
import type Token from 'markdown-it/lib/token.mjs';
import type { ConvertToDocxSettings } from '../Obsidian/ConvertToDocxSettingTab';

type ListType = 'bullet' | 'ordered';

interface TableState {
  inHeader: boolean;
  rows: TableRow[];
  currentCells: TableCell[];
  cellRuns: TextRun[];
  inCell: boolean;
}

export class DocxConverter {
  /**
   * Public entry: read, convert, and write.
   */
  public static async convertFile(
    file: TFile,
    vault: Vault,
    settings: ConvertToDocxSettings
  ): Promise<string> {
    const target = this.computeTargetPath(file);
    await this.guardOverwrite(target, vault, settings.overwrite);

    const mdContent = await this.readMarkdown(file, vault);
    const buffer = await this.buildDocBuffer(mdContent, settings, file.name);

    await this.writeDocx(target, buffer, vault);
    return target;
  }

  /** Compute a robust target path ending in .docx */
  private static computeTargetPath(file: TFile): string {
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
    if (overwrite) return;
    try {
      if (await vault.adapter.exists(target)) {
        throw new FileExistsError(target);
      }
    } catch (err) {
      if (err instanceof FileExistsError) throw err;
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

  /** Build the DOCX buffer from markdown + settings */
  private static async buildDocBuffer(
    mdContent: string,
    settings: ConvertToDocxSettings,
    fileName: string
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

    try {
      const doc = this.buildDocument(tokens, settings, fileName);
      const buffer = await Packer.toBuffer(doc);
      return Uint8Array.from(buffer).buffer;
    } catch (err) {
      throw new ConversionError(
        `DOCX generation failed: ${(err as Error).message}`
      );
    }
  }

  /**
   * Compose a `docx.Document` given tokens + user settings.
   */
  private static buildDocument(
    tokens: Token[],
    settings: ConvertToDocxSettings,
    fileName: string
  ): Document {
    let workingTokens = [...tokens];
    const sections: any[] = [];

    // — COVER PAGE —
    if (settings.includeCoverPage) {
      const { title, subtitle, summary, bodyTokens } = this.extractCoverPageData(workingTokens, fileName);
      
      const coverParas: Paragraph[] = [
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
          //alignment: AlignmentType.CENTER,
        }),
      ];
      if (subtitle) {
        coverParas.push(
          new Paragraph({
            text: subtitle,
            heading: HeadingLevel.HEADING_1,
            //alignment: AlignmentType.CENTER,
          })
        );
      }
      if (summary) {
        coverParas.push(
          new Paragraph({
            text: summary,
            //alignment: AlignmentType.CENTER,
          })
        );
      }

      sections.push({ children: coverParas });
      workingTokens = bodyTokens;
    }

    // — TABLE OF CONTENTS —
    if (settings.includeToc) {
      // we just create a placeholder as programmatically created tocs prompt the user to allow them everytime he opens the doc
      sections.push({
        properties: settings.includeCoverPage
          ? { type: SectionType.NEXT_PAGE }
          : undefined,
        children: [
          new Paragraph({
            text: 'Insert TOC here',
            heading: HeadingLevel.HEADING_2,
          })
        ],
      });
    }

    // — MAIN BODY —
    sections.push({
      properties:
        settings.includeCoverPage || settings.includeToc
          ? { type: SectionType.NEXT_PAGE }
          : undefined,
      children: this.convertTokensToDocxParagraphs(workingTokens),
    });

    return new Document({ sections });
  }

  /**
   * From tokens, extract cover-page fields and return the remaining body tokens.
   */
  private static extractCoverPageData(
    tokens: Token[],
    fileName: string
  ): {
    title: string;
    subtitle: string;
    summary: string;
    bodyTokens: Token[];
  } {
    const baseName = fileName.replace(/\.md$/, '');
    let subtitle = '';
    let summary = '';
    const bodyTokens = [...tokens];

    const index = tokens.findIndex(
      (token) => token.type === 'heading_open' && token.tag === 'h1'
    );
    if (index !== -1) {
      subtitle = tokens[index + 1].content;
      // Check for an inline paragraph immediately after H1
      if (
        tokens[index + 2]?.type === 'heading_close' &&
        tokens[index + 3]?.type === 'paragraph_open'
      ) {
        summary = tokens[index + 4].content;
        // Remove: h1_open, inline, h1_close, summary_inline, summary_close (5 tokens)
        bodyTokens.splice(index, 5);
      } else {
        // Remove only the H1 tokens
        bodyTokens.splice(index, 3);
      }
    }

    return { title: baseName, subtitle, summary, bodyTokens };
  }

  /**
   * Convert the remaining markdown-it tokens into docx Paragraphs.
   */
    private static convertTokensToDocxParagraphs(
    tokens: Token[]
  ): (Paragraph | Table)[] {
    const headingMap = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    } as const;

    const elements: (Paragraph | Table)[] = [];
    let currentLevel: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
    const unhandledTypes = new Set<string>();

    // — LIST STATE —
    const listStack: { type: ListType; counter: number }[] = [];
    let isInListItem = false;

    // — TABLE STATE —
    let tableState: TableState | null = null;

    for (const token of tokens) {
      switch (token.type) {
        // —— LISTS ——
        case 'bullet_list_open':
          listStack.push({ type: 'bullet', counter: 0 });
          break;
        case 'ordered_list_open':
          listStack.push({ type: 'ordered', counter: 0 });
          break;
        case 'bullet_list_close':
        case 'ordered_list_close':
          listStack.pop();
          break;

        case 'list_item_open':
          if (listStack.length > 0 && listStack[listStack.length - 1].type === 'ordered') {
            listStack[listStack.length - 1].counter++;
          }
          isInListItem = true;
          break;
        case 'list_item_close':
          isInListItem = false;
          break;

        // —— PARAGRAPHS & HEADINGS ——
        case 'paragraph_open':
          // emit on inline
          break;
        case 'paragraph_close':
          break;
        case 'heading_open':
          currentLevel = Number(token.tag.slice(1)) as
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6;
          break;
        case 'heading_close':
          break;

        // —— FENCES ——
        case 'fence': {
          elements.push(
            new Paragraph({
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({
                  text: token.content,
                  font: 'Courier New',
                }),
              ],
            })
          );
          break;
        }

        // —— TABLES ——
        case 'table_open':
          tableState = {
            inHeader: false,
            rows: [],
            currentCells: [],
            cellRuns: [],
            inCell: false,
          };
          break;
        case 'thead_open':
          if (tableState) tableState.inHeader = true;
          break;
        case 'thead_close':
          // leave header mode
          break;
        case 'tbody_open':
          if (tableState) tableState.inHeader = false;
          break;
        case 'tbody_close':
          break;
        case 'tr_open':
          if (tableState) tableState.currentCells = [];
          break;
        case 'tr_close':
          if (tableState) {
            tableState.rows.push(
              new TableRow({ children: tableState.currentCells })
            );
          }
          break;
        case 'th_open':
        case 'td_open':
          if (tableState) {
            tableState.cellRuns = [];
            tableState.inCell = true;
          }
          break;
        case 'th_close':
        case 'td_close':
          if (tableState && tableState.inCell) {
            // wrap collected runs in a Paragraph + TableCell
            const cellPara = new Paragraph({
              children: tableState.cellRuns,
            });
            tableState.currentCells.push(
              new TableCell({ children: [cellPara] })
            );
            tableState.inCell = false;
          }
          break;
        case 'table_close':
          if (tableState) {
            elements.push(
              new Table({
                rows: tableState.rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
            tableState = null;
          }
          break;

        // —— INLINE CONTENT ——
        case 'inline': {
          // inside a table cell?
          if (tableState && tableState.inCell) {
            const runs = InlineFormatter.format(token.children as Token[]);
            tableState.cellRuns.push(...runs);
          }
          // list item?
          else if (isInListItem && listStack.length > 0) {
            const { type, counter } = listStack[listStack.length - 1];
            const prefix = type === 'bullet' ? '• ' : `${counter}. `;
            const runs = InlineFormatter.format(token.children as Token[]);
            elements.push(
              new Paragraph({
                indent: { left: 720 * listStack.length },
                children: [new TextRun({ text: prefix }), ...runs],
              })
            );
          }
          // normal paragraph or heading
          else {
            const runs = InlineFormatter.format(token.children as Token[]);
            elements.push(
              new Paragraph({
                heading: currentLevel ? headingMap[currentLevel] : undefined,
                children: runs,
              })
            );
            currentLevel = undefined;
          }
          break;
        }

        default:
          unhandledTypes.add(token.type);
      }
    }

    if (unhandledTypes.size > 0) {
      console.warn(
        `[DocxConverter] Unhandled markdown token types: ${Array.from(
          unhandledTypes
        ).join(', ')}`
      );
    }

    return elements;
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
