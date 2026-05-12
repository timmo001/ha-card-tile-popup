import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { assert } from "superstruct";
import { fireEvent } from "../ha/common/dom/fire_event";
import { configElementStyle } from "../ha";
import type { HomeAssistant, LovelaceCardConfig, LovelaceConfig } from "../ha";
import type { HaFormSchema } from "../utils/form/ha-form";
import { CARD_EDITOR_NAME, CARD_NAME } from "./const";
import { type TilePopupConfig, tilePopupConfigStruct } from "./tile-popup-config";
import "./tile-popup-card-list-editor";
import type { CardsChangedEvent } from "./tile-popup-card-list-editor";

const CARD_SCHEMA: readonly HaFormSchema[] = [
  {
    name: "",
    type: "grid",
    schema: [
      {
        name: "label",
        selector: {
          text: {},
        },
      },
      {
        name: "secondary",
        selector: {
          text: {},
        },
      },
    ],
  },
  {
    name: "icon",
    selector: {
      icon: {
        placeholder: "mdi:cards",
      },
    },
  },
] as const;

@customElement(CARD_EDITOR_NAME)
export class TilePopupEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public lovelace?: LovelaceConfig;

  @state() private _config?: TilePopupConfig;

  public setConfig(config: TilePopupConfig): void {
    assert(config, tilePopupConfigStruct);
    this._config = config;
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${CARD_SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._formValueChanged}
      ></ha-form>
      <div class="cards-header">Cards</div>
      <tile-popup-card-list-editor
        .hass=${this.hass}
        .lovelace=${this.lovelace}
        .cards=${this._config.cards ?? []}
        @cards-changed=${this._cardsChanged}
      ></tile-popup-card-list-editor>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string | undefined => {
    switch (schema.name) {
      case "label":
        return "Label";
      case "secondary":
        return "Secondary";
      case "icon":
        return "Icon";
      default:
        return undefined;
    }
  };

  private _formValueChanged = (ev: CustomEvent) => {
    ev.stopPropagation();
    if (!this._config) {
      return;
    }

    const config = {
      ...this._config,
      ...ev.detail.value,
    };

    this._configChanged(config);
  };

  private _cardsChanged = (ev: CustomEvent<CardsChangedEvent>) => {
    ev.stopPropagation();
    if (!this._config) {
      return;
    }

    this._configChanged({
      ...this._config,
      cards: ev.detail.cards,
    });
  };

  private _configChanged(config: TilePopupConfig) {
    this._config = {
      ...config,
      type: `custom:${CARD_NAME}`,
    };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
      })
    );
  }

  static get styles() {
    return [
      configElementStyle,
      css`
        ha-form {
          display: block;
        }

        .cards-header {
          font-weight: 500;
          font-size: var(--ha-font-size-l, 16px);
          margin-top: var(--ha-space-4, 16px);
          margin-bottom: var(--ha-space-2, 8px);
        }

        tile-popup-card-list-editor {
          display: block;
        }
      `,
    ];
  }
}
