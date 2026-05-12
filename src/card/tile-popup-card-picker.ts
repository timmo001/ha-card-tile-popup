import type { CSSResultGroup } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { coreCards, energyCards } from "../../vendor/home-assistant-frontend/src/panels/lovelace/editor/lovelace-cards";

interface HomeAssistant {
  language?: string;
  localize(key: string, vars?: Record<string, unknown>): string;
}

interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

type CustomCardRegistration = {
  type: string;
  name: string;
  description: string;
  preview: boolean;
};

type PickerCard = {
  type: string;
  name: string;
  description: string;
  isCustom?: boolean;
  isEnergy?: boolean;
  isSuggested?: boolean;
};

declare global {
  interface Window {
    customCards?: CustomCardRegistration[];
  }
}

const CLIPBOARD_KEY = "dashboardCardClipboard";

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

const readClipboard = (): LovelaceCardConfig | undefined => {
  const value = sessionStorage.getItem(CLIPBOARD_KEY);

  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as LovelaceCardConfig;
  } catch {
    return undefined;
  }
};

@customElement("tile-popup-card-picker")
export class TilePopupCardPicker extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public suggestedCards?: string[];

  @state() private _filter = "";

  protected override render() {
    if (!this.hass) {
      return nothing;
    }

    const cards = this._cards();
    const filteredCards = this._filterCards(cards);
    const suggested = filteredCards.filter((card) => card.isSuggested);
    const core = filteredCards.filter(
      (card) => !card.isSuggested && !card.isCustom && !card.isEnergy
    );
    const energy = filteredCards.filter((card) => card.isEnergy);
    const custom = filteredCards.filter((card) => card.isCustom);
    const clipboard = readClipboard();

    return html`
      <ha-input-search
        appearance="outlined"
        .value=${this._filter}
        .placeholder=${this.hass.localize(
          "ui.panel.lovelace.editor.edit_card.search_cards"
        )}
        @input=${this._handleSearchChange}
      ></ha-input-search>
      <div id="content">
        ${this._filter
          ? html`<div class="cards-container">${filteredCards.map((card) => this._renderCard(card))}</div>`
          : html`
              ${suggested.length
                ? html`
                    <ha-expansion-panel expanded>
                      <div slot="header" class="cards-container-header">
                        ${this.hass.localize(
                          "ui.panel.lovelace.editor.card.generic.suggested_cards"
                        )}
                      </div>
                      <div class="cards-container">
                        ${clipboard ? this._renderClipboardCard(clipboard) : nothing}
                        ${suggested.map((card) => this._renderCard(card))}
                      </div>
                    </ha-expansion-panel>
                  `
                : nothing}
              <ha-expansion-panel expanded>
                <div slot="header" class="cards-container-header">
                  ${this.hass.localize(
                    "ui.panel.lovelace.editor.card.generic.core_cards"
                  )}
                </div>
                <div class="cards-container">
                  ${!suggested.length && clipboard
                    ? this._renderClipboardCard(clipboard)
                    : nothing}
                  ${core.map((card) => this._renderCard(card))}
                </div>
              </ha-expansion-panel>
              ${energy.length
                ? html`
                    <ha-expansion-panel>
                      <div slot="header" class="cards-container-header">
                        ${this.hass.localize(
                          "ui.panel.lovelace.editor.card.generic.energy_cards"
                        )}
                      </div>
                      <div class="cards-container">
                        ${energy.map((card) => this._renderCard(card))}
                      </div>
                    </ha-expansion-panel>
                  `
                : nothing}
              ${custom.length
                ? html`
                    <ha-expansion-panel expanded>
                      <div slot="header" class="cards-container-header">
                        ${this.hass.localize(
                          "ui.panel.lovelace.editor.card.generic.custom_cards"
                        )}
                      </div>
                      <div class="cards-container">
                        ${custom.map((card) => this._renderCard(card))}
                      </div>
                    </ha-expansion-panel>
                  `
                : nothing}
            `}
        <div class="cards-container manual-container">
          <button class="card manual" type="button" @click=${this._pickManualCard}>
            <div class="card-header">
              ${this.hass.localize("ui.panel.lovelace.editor.card.generic.manual")}
            </div>
            <div class="description">
              ${this.hass.localize(
                "ui.panel.lovelace.editor.card.generic.manual_description"
              )}
            </div>
          </button>
        </div>
      </div>
    `;
  }

  private _cards(): PickerCard[] {
    const suggested = new Set(this.suggestedCards);
    const localized = (type: string) => {
      const name = this.hass?.localize(`ui.panel.lovelace.editor.card.${type}.name`);
      const description = this.hass?.localize(
        `ui.panel.lovelace.editor.card.${type}.description`
      );

      return {
        name: name || type,
        description: description || "",
      };
    };

    const builtin = coreCards.map((card) => ({
      type: card.type,
      ...localized(card.type),
      isSuggested: suggested.has(card.type),
    }));

    const energy = energyCards.map((card) => ({
      type: card.type,
      ...localized(card.type),
      isEnergy: true,
    }));

    const custom = (window.customCards || [])
      .map((card) => ({
        type: `custom:${card.type}`,
        name: card.name || card.type,
        description: card.description || "",
        isCustom: true,
      }))
      .sort((left, right) => compareText(left.name, right.name));

    return [...builtin, ...energy, ...custom].sort((left, right) => {
      if (left.isSuggested && !right.isSuggested) {
        return -1;
      }

      if (!left.isSuggested && right.isSuggested) {
        return 1;
      }

      return compareText(left.name, right.name);
    });
  }

  private _filterCards(cards: PickerCard[]): PickerCard[] {
    const filter = this._filter.trim().toLowerCase();

    if (!filter) {
      return cards;
    }

    return cards.filter((card) =>
      [card.type, card.name, card.description].some((value) =>
        value.toLowerCase().includes(filter)
      )
    );
  }

  private _renderCard(card: PickerCard) {
    return html`
      <button class="card" type="button" @click=${() => this._pickCard({ type: card.type })}>
        <div class="card-header">${card.name}</div>
        <div class="description">${card.description}</div>
      </button>
    `;
  }

  private _renderClipboardCard(clipboard: LovelaceCardConfig) {
    return html`
      <button class="card" type="button" @click=${() => this._pickCard(clipboard)}>
        <div class="card-header">
          ${this.hass?.localize("ui.panel.lovelace.editor.card.generic.paste") || "Paste"}
        </div>
        <div class="description">${clipboard.type}</div>
      </button>
    `;
  }

  private _handleSearchChange(ev: Event): void {
    this._filter = (ev.currentTarget as HTMLInputElement).value || "";
  }

  private _pickManualCard(): void {
    this._pickCard({ type: "" });
  }

  private _pickCard(config: LovelaceCardConfig): void {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: structuredClone(config) },
        bubbles: true,
        composed: true,
      })
    );
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      ha-input-search {
        padding: 12px 12px 0;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      #content {
        min-height: 0;
        overflow: auto;
      }

      .cards-container {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        padding: 12px;
      }

      .cards-container-header {
        font-size: var(--ha-font-size-l);
        font-weight: var(--ha-font-weight-medium);
        padding: 12px 8px;
      }

      .card {
        appearance: none;
        background: var(--primary-background-color, #fafafa);
        border: 1px solid var(--ha-card-border-color, var(--divider-color));
        border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
        color: inherit;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 120px;
        padding: 16px;
        text-align: left;
      }

      .card:hover {
        border-color: var(--primary-color);
      }

      .card-header {
        font-size: var(--ha-font-size-l);
        font-weight: var(--ha-font-weight-bold);
      }

      .description {
        color: var(--secondary-text-color);
        font-size: var(--ha-font-size-m);
      }

      .manual-container {
        padding-top: 0;
      }

      .manual {
        grid-column: 1 / -1;
        min-height: auto;
      }
    `;
  }
}
