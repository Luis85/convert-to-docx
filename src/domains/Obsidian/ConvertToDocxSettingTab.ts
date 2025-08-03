import { App, PluginSettingTab } from 'obsidian';
import { Setting } from 'obsidian';
import ConvertToDocxPlugin from '../../main';

export interface ConvertToDocxSettings {
  // When true, overwrite existing .docx files automatically
  overwrite: boolean;
  // add a cover page to the document
  includeCoverPage: boolean;
  // add a table of contents to the document
  includeToc: boolean;
}

export const DEFAULT_SETTINGS: ConvertToDocxSettings = {
  overwrite: true,
  includeCoverPage: true,
  includeToc: true,
};

export class ConvertToDocxSettingTab extends PluginSettingTab {
  plugin: ConvertToDocxPlugin;

  constructor(app: App, plugin: ConvertToDocxPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Convert to DOCX Settings' });

    new Setting(containerEl)
      .setName('Auto-overwrite existing DOCX')
      .setDesc('If enabled, .docx files will be silently replaced instead of prompting.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings!.overwrite)
          .onChange(async (value) => {
            this.plugin.settings!.overwrite = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl)
      .setName('Include Cover Page')
      .setDesc('If enabled, insert a cover page with file name, first H1, and summary.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.includeCoverPage)
          .onChange(async (value) => {
            this.plugin.settings.includeCoverPage = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl)
      .setName('Create Placeholder for TOC')
      .setDesc('If enabled, insert a blank page before the documents content for a potential table of contents.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.includeToc)
          .onChange(async (value) => {
            this.plugin.settings.includeToc = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
