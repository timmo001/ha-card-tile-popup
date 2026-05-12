import type { CSSResultGroup } from "lit";
import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { assert } from "superstruct";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceGridOptions,
} from "../ha";
import { BaseElement } from "../utils/base-element";
import { registerCustomCard } from "../utils/custom-cards";
import {
  CARD_DESCRIPTION,
  CARD_EDITOR_NAME,
  CARD_NAME,
  CARD_NAME_FRIENDLY,
} from "./const";
import { type TilePopupConfig, tilePopupConfigStruct } from "./tile-popup-config";
import type { TilePopupDialog } from "./tile-popup-dialog";

registerCustomCard({
  type: CARD_NAME,
  name: CARD_NAME_FRIENDLY,
  description: CARD_DESCRIPTION,
});

@customElement(CARD_NAME)
export class TilePopup extends BaseElement implements LovelaceCard {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./tile-popup-editor");
    return document.createElement(CARD_EDITOR_NAME) as LovelaceCardEditor;
  }

  public static getStubConfig(): TilePopupConfig {
    return {
      type: `custom:${CARD_NAME}`,
      label: "Popup",
      cards: [],
    };
  }

  @property({ attribute: false }) public override hass!: HomeAssistant;

  @state() private _config?: TilePopupConfig;

  private _dialogEl?: TilePopupDialog;

  public setConfig(config: TilePopupConfig): void {
    assert(config, tilePopupConfigStruct);
    this._config = config;
  }

  public getCardSize(): number {
    return 1;
  }

  public getGridOptions(): LovelaceGridOptions {
    return {
      columns: 6,
      rows: 1,
      min_columns: 3,
      min_rows: 1,
    };
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }

    const label = this._config.label || CARD_NAME_FRIENDLY;
    const icon = this._config.icon;

    return html`
      <ha-card>
        <ha-tile-container
          .interactive=${true}
          @click=${this._handleClick}
        >
          <ha-tile-icon
            slot="icon"
            .icon=${icon || undefined}
            .iconPath=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}
          ></ha-tile-icon>
          <ha-tile-info slot="info">
            <span slot="primary">${label}</span>
            ${this._config.secondary
              ? html`<span slot="secondary">${this._config.secondary}</span>`
              : nothing}
          </ha-tile-info>
        </ha-tile-container>
      </ha-card>
    `;
  }

  private _handleClick = async () => {
    if (!this._config?.cards?.length || !this.hass) {
      return;
    }

    if (this._dialogEl) {
      return;
    }

    const { TilePopupDialog } = await import("./tile-popup-dialog");
    const dialog = new TilePopupDialog();
    dialog.hass = this.hass;
    dialog.cards = this._config.cards;
    dialog.anchor = this;

    dialog.addEventListener("closed", () => {
      dialog.remove();
      this._dialogEl = undefined;
    });

    this._dialogEl = dialog;
    document.body.appendChild(dialog);
  };

  static get styles(): CSSResultGroup {
    return [
      css`
        ha-card:has(ha-tile-container[focused]) {
          --shadow-default: var(--ha-card-box-shadow, 0 0 0 0 transparent);
          --shadow-focus: 0 0 0 1px var(--tile-color);
          border-color: var(--tile-color);
          box-shadow: var(--shadow-default), var(--shadow-focus);
        }
        ha-card {
          height: 100%;
          transition:
            box-shadow 180ms ease-in-out,
            border-color 180ms ease-in-out;
        }
        :host {
          --tile-color: var(--primary-color);
        }
        ha-tile-icon {
          --tile-icon-color: var(--tile-color);
        }
      `,
    ];
  }
}
