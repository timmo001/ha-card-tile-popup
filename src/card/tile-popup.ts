import { repository } from "../../package.json";
import type { CSSResultGroup } from "lit";
import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { assert } from "superstruct";
import type { ActionHandlerEvent } from "../../vendor/home-assistant-frontend/src/data/lovelace/action_handler";
import { computeCssColor } from "../../vendor/home-assistant-frontend/src/common/color/compute-color";
import {
  CARD_DESCRIPTION,
  CARD_EDITOR_NAME,
  CARD_NAME,
  CARD_NAME_FRIENDLY,
} from "./const";
import { type TilePopupConfig, tilePopupConfigStruct } from "./tile-popup-config";
import type { TilePopupDialog } from "./tile-popup-dialog";

interface HomeAssistant {
  themes: {
    darkMode?: boolean;
  };
}

interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

interface LovelaceCardEditor extends HTMLElement {
  setConfig(config: LovelaceCardConfig): void;
}

interface LovelaceGridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  max_columns?: number;
  min_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  getCardSize(): number | Promise<number>;
  getGridOptions?(): LovelaceGridOptions;
  setConfig(config: LovelaceCardConfig): void;
}

type CustomCardRegistration = {
  type: string;
  name: string;
  description: string;
  preview: boolean;
  documentationURL: string;
};

declare global {
  interface Window {
    customCards?: CustomCardRegistration[];
  }
}

const customCards = window.customCards ?? [];

if (!window.customCards) {
  window.customCards = customCards;
}

if (!customCards.some((card) => card.type === CARD_NAME)) {
  customCards.push({
    type: CARD_NAME,
    name: CARD_NAME_FRIENDLY,
    description: CARD_DESCRIPTION,
    preview: true,
    documentationURL: `${repository.url}/blob/main/docs/cards/${CARD_NAME}.md`,
  });
}

@customElement(CARD_NAME)
export class TilePopup extends LitElement implements LovelaceCard {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    const { ensureTilePopupEditor } = await import("./tile-popup-editor");
    await ensureTilePopupEditor();
    return document.createElement(CARD_EDITOR_NAME) as LovelaceCardEditor;
  }

  public static getStubConfig(): TilePopupConfig {
    return {
      type: `custom:${CARD_NAME}`,
      label: "Popup",
      cards: [],
    };
  }

  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: TilePopupConfig;

  private _dialogEl?: TilePopupDialog;

  protected override updated(changedProps: PropertyValues<this>): void {
    super.updated(changedProps);
    if (!changedProps.has("hass") || !this.hass) {
      return;
    }

    const previousHass = changedProps.get("hass") as HomeAssistant | undefined;
    const previousDarkMode = previousHass ? Boolean(previousHass.themes.darkMode) : false;
    const currentDarkMode = Boolean(this.hass.themes.darkMode);

    if (previousDarkMode !== currentDarkMode) {
      this.toggleAttribute("dark-mode", currentDarkMode);
    }
  }

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
    const iconColor = this._config.icon_color
      ? computeCssColor(this._config.icon_color)
      : undefined;

    return html`
        <ha-card style=${iconColor ? `--tile-color: ${iconColor};` : nothing}>
          <ha-tile-container
            .interactive=${true}
            .actionHandlerOptions=${{}}
            @action=${this._handleAction}
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

  private _handleAction = async (_ev: ActionHandlerEvent) => {
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
    dialog.width = this._config.width;

    dialog.addEventListener("closed", (ev) => {
      if (ev.target !== dialog) {
        return;
      }

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
