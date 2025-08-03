import { Plugin, TFile, Notice } from 'obsidian';
import { DocxConverter } from './domains/Converter/DocxConverter';
import { FileExistsError, getErrorMessage } from './domains/Errors/ConversionErrors';
import { ConfirmOverwriteModal } from './domains/Obsidian/ConfirmOverwriteModal';


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

	this.addCommand({
		id: 'convert-md-to-docx',
		name: 'Convert current note to DOCX',
		checkCallback: (checking: boolean) => {
			const file = this.app.workspace.getActiveFile();
			if (file && file.extension === 'md') {
			if (!checking) {
				this.convertFile(file);
			}
			return true;
			}
			return false;
		}
	});

  }

	async convertFile(file: TFile) {
		const statusNotice = new Notice(`⏳ Converting "${file.name}"…`, 0);

		try {
			const newPath = await DocxConverter.convertFile(file, this.app.vault);
			statusNotice.hide();
			new Notice(`✅ Converted "${file.name}" → "${newPath}"`);
		} catch (err) {
			statusNotice.hide();

			// 1) If it’s a FileExistsError, ask before overwriting
			if (err instanceof FileExistsError) {
			new ConfirmOverwriteModal(
				this.app,
				`A DOCX already exists at “${err.path}”. Overwrite?`,
				async () => {
				try {
					// delete the existing file, then retry
					await this.app.vault.adapter.remove(err.path);
					// small delay so UI can settle
					setTimeout(() => this.convertFile(file), 100);
				} catch (e) {
					console.error(e);
					new Notice(
					'❌ Failed to remove existing file: ' + (e as Error).message
					);
				}
				}
			).open();
			return;
			}

			// 2) All other errors → friendly message
			console.error(err);
			new Notice('❌ ' + getErrorMessage(err));
		}
	}

}
