import { Plugin, TFile, Notice } from 'obsidian';
import { DocxConverter } from './domains/Converter/DocxConverter';

export default class ConvertToDocxPlugin extends Plugin {
  onload() {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && file.extension === 'md') {
          menu.addItem(item =>
            item
              .setTitle('Convert to DOCX')
              .setIcon('document')
              .onClick(() => this.convertFile(file))
          );
        }
      })
    );
  }

  async convertFile(file: TFile) {
    try {
      const newPath = await DocxConverter.convertFile(file, this.app.vault);
      new Notice(`✅ Converted "${file.name}" → "${newPath}"`);
    } catch (err) {
      console.error(err);
      new Notice('❌ Conversion failed: ' + (err as Error).message);
    }
  }
}
