import { App, PluginSettingTab } from 'obsidian';
import { Setting } from 'obsidian';
import ConvertToDocxPlugin from '../../main';

export interface ConvertToDocxSettings {
  /** When true, overwrite existing .docx files automatically */
  overwrite: boolean;
}

export const DEFAULT_SETTINGS: ConvertToDocxSettings = {
  overwrite: false,
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
  }
}
