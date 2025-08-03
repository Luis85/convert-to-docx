import { Plugin, TFile, Notice } from 'obsidian';
import { DocxConverter } from './domains/Converter/DocxConverter';
import { FileExistsError, getErrorMessage } from './domains/Errors/ConversionErrors';
import { ConfirmOverwriteModal } from './domains/Obsidian/ConfirmOverwriteModal';
import { ConvertToDocxSettingTab, ConvertToDocxSettings, DEFAULT_SETTINGS } from './domains/Obsidian/ConvertToDocxSettingTab';

export default class ConvertToDocxPlugin extends Plugin {
  settings: ConvertToDocxSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ConvertToDocxSettingTab(this.app, this));

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
      },
    });
  }

  async loadSettings() {
    const data = await this.loadData();
    Object.assign(this.settings, data ?? {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Public entry point for converting a file, respects user overwrite setting.
   */
  async convertFile(file: TFile): Promise<void> {
    return this.runConvert(file, this.settings.overwrite);
  }

  /**
   * Core conversion logic with controlled retry/overwrite handling.
   */
  private async runConvert(file: TFile, overwriteFlag: boolean): Promise<void> {
    const statusNotice = new Notice(`⏳ Converting "${file.name}"…`, 0);
    try {
      const newPath = await DocxConverter.convertFile(
        file,
        this.app.vault,
        this.settings
      );
      statusNotice.hide();
      new Notice(`✅ Converted "${file.name}" → "${newPath}"`);
    } catch (err) {
      statusNotice.hide();

      if (err instanceof FileExistsError) {
        if (overwriteFlag) {
          try {
            await this.app.vault.adapter.remove(err.path);
            return this.runConvert(file, overwriteFlag);
          } catch (removeErr) {
            console.error('ConvertToDocxPlugin.overwriteError:', removeErr);
            new Notice('❌ Failed to overwrite existing file: ' + (removeErr as Error).message);
            return;
          }
        }
        // prompt user for overwrite
        return this.promptAndOverwrite(file, err.path);
      }

      console.error('ConvertToDocxPlugin.runConvert:', err);
      new Notice('❌ ' + getErrorMessage(err));
    }
  }

  /**
   * Show a confirmation modal and retry conversion with overwrite enabled.
   */
  private promptAndOverwrite(file: TFile, existingPath: string): void {
    new ConfirmOverwriteModal(
      this.app,
      `A DOCX already exists at "${existingPath}". Overwrite?`,
      async () => {
        try {
          await this.app.vault.adapter.remove(existingPath);
          await this.runConvert(file, true);
        } catch (e) {
          console.error('ConvertToDocxPlugin.promptOverwriteError:', e);
          new Notice(
            '❌ Failed to remove existing file: ' + (e as Error).message
          );
        }
      }
    ).open();
  }
}
