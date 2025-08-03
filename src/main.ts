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
	// 1) show an in-progress notice
	const statusNotice = new Notice(`⏳ Converting "${file.name}"…`, 0); // timeout = 0 → stays until .hide()

	try {
		const newPath = await DocxConverter.convertFile(file, this.app.vault);
		statusNotice.hide();
		new Notice(`✅ Converted "${file.name}" → "${newPath}"`);
	} catch (err) {
		statusNotice.hide();
		console.error(err);
		new Notice('❌ Conversion failed: ' + (err as Error).message);
	}
	}
}
