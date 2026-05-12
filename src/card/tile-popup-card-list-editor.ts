import { css, html, LitElement, nothing } from "lit";
import { customElement, property, queryAsync, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceConfig } from "../ha";

type GridEditorElement = HTMLElement & {
  hass?: HomeAssistant;
  lovelace?: LovelaceConfig;
  setConfig(config: { type: "grid"; cards: unknown[] }): void;
  shadowRoot: ShadowRoot;
};

@customElement("tile-popup-card-list-editor")
export class TilePopupCardListEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public lovelace?: LovelaceConfig;

  @property({ attribute: false }) public config: { type: "grid"; cards: unknown[] } = {
    type: "grid",
    cards: [],
  };

  @state() private _gridEditorReady = false;

  @queryAsync("hui-grid-card-editor")
  private _gridEditor!: Promise<GridEditorElement | null>;

  protected override async firstUpdated() {
    await customElements.whenDefined("hui-grid-card-editor");
    this._gridEditorReady = true;
    await this._syncGridEditor();
    await this._hideGridFields();
  }

  protected override updated(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has("config") ||
      changedProperties.has("hass") ||
      changedProperties.has("lovelace")
    ) {
      void this._syncGridEditor();
    }
  }

  protected render() {
    if (!this._gridEditorReady) {
      return nothing;
    }

    return html`
      <hui-grid-card-editor
        .hass=${this.hass}
        .lovelace=${this.lovelace}
        @config-changed=${this._handleConfigChanged}
      ></hui-grid-card-editor>
    `;
  }

  private async _syncGridEditor() {
    const editor = await this._gridEditor;
    if (!editor) {
      return;
    }

    editor.hass = this.hass;
    editor.lovelace = this.lovelace;
    editor.setConfig(this.config);

    await this._hideGridFields();
  }

  private async _hideGridFields() {
    const editor = await this._gridEditor;
    if (!editor?.shadowRoot) {
      return;
    }

    const form = editor.shadowRoot.querySelector("ha-form") as HTMLElement | null;
    if (form) {
      form.style.display = "none";
    }
  }

  private _handleConfigChanged(ev: Event) {
    ev.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: (ev as CustomEvent).detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  static styles = css`
    :host {
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "tile-popup-card-list-editor": TilePopupCardListEditor;
  }
}
