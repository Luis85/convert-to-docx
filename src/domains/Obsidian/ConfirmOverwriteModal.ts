import { Modal, ButtonComponent, App } from 'obsidian';

/**
 * A simple yes/no modal. Calls `onConfirm()` if the user clicks “Overwrite”.
 */
export class ConfirmOverwriteModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private onConfirm: () => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('p', { text: this.message });
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    new ButtonComponent(btnContainer)
      .setButtonText('Cancel')
      .onClick(() => this.close());

    new ButtonComponent(btnContainer)
      .setButtonText('Overwrite')
      .setCta()
      .onClick(() => {
        this.close();
        this.onConfirm();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
