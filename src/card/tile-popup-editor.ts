import {
  mdiCodeBraces,
  mdiContentCopy,
  mdiContentCut,
  mdiDelete,
  mdiListBoxOutline,
  mdiPlus,
} from "@mdi/js";
import type { CSSResultGroup } from "lit";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { assert } from "superstruct";
import { CARD_EDITOR_NAME } from "./const";
import "./tile-popup-card-picker";
import {
  getTilePopupSectionWidthCount,
  type TilePopupConfig,
  tilePopupConfigStruct,
} from "./tile-popup-config";

interface HomeAssistant {
  localize(key: string): string;
}

interface LovelaceConfig {
  views?: unknown[];
}

interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

type HaFormSchema = {
  name: string;
  type?: "grid";
  schema?: readonly HaFormSchema[];
  selector?: Record<string, unknown>;
};

type HaFormValueChangedEvent = CustomEvent<{
  value: Partial<TilePopupConfig>;
}>;

type ConfigChangedEvent = CustomEvent<{
  config: LovelaceCardConfig;
  guiModeAvailable?: boolean;
}>;

type GUIModeChangedEvent = CustomEvent<{
  guiMode: boolean;
  guiModeAvailable: boolean;
}>;

type TabChangedEvent = CustomEvent<{
  name: string;
}>;

type MoveButton = HTMLElement & {
  move: number;
};

type RuntimeCardEditor = HTMLElement & {
  toggleMode(): void;
  focusYamlEditor(): void;
};

const CLIPBOARD_KEY = "dashboardCardClipboard";
const SECTION_WIDTH_MIN = 1;
const SECTION_WIDTH_MAX = 10;
const SECTION_WIDTH_DEFAULT = 1;

const CARD_WIDTH_SCHEMA: readonly HaFormSchema[] = [
  {
    name: "width",
    selector: {
      number: {
        min: SECTION_WIDTH_MIN,
        max: SECTION_WIDTH_MAX,
        mode: "slider",
        slider_ticks: true,
      },
    },
  },
] as const;

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
  {
    name: "icon_color",
    selector: {
      ui_color: {
        default_color: "primary",
      },
    },
  },
] as const;

const computeLabel = (schema: HaFormSchema): string | undefined => {
  switch (schema.name) {
    case "label":
      return "Label";
    case "secondary":
      return "Secondary";
    case "icon":
      return "Icon";
    case "icon_color":
      return "Icon color";
    case "width":
      return "Popover width";
    default:
      return undefined;
  }
};

const computeHelper = (schema: HaFormSchema): string | undefined => {
  switch (schema.name) {
    case "width":
      return "Matches the sections view sizing scale. Use YAML with a px string for an exact width override.";
    default:
      return undefined;
  }
};

const emitConfigChanged = (target: HTMLElement, config: TilePopupConfig): void => {
  target.dispatchEvent(
    new CustomEvent("config-changed", {
      detail: { config },
      bubbles: true,
      composed: true,
    })
  );
};

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

const writeClipboard = (config: LovelaceCardConfig): void => {
  sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(config));
};

const cloneCardConfig = (config: LovelaceCardConfig): LovelaceCardConfig =>
  JSON.parse(JSON.stringify(config)) as LovelaceCardConfig;

@customElement(CARD_EDITOR_NAME)
class TilePopupEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public lovelace?: LovelaceConfig;

  @state() private _config?: TilePopupConfig;

  @state() private _selectedCard = 0;

  @state() private _guiMode = true;

  @state() private _guiModeAvailable = true;

  private _keys = new Map<string, string>();

  @query("hui-card-element-editor")
  private _cardEditorEl?: RuntimeCardEditor;

  public setConfig(config: TilePopupConfig): void {
    assert(config, tilePopupConfigStruct);
    this._config = config;
    this._selectedCard = Math.min(this._selectedCard, config.cards.length);
  }

  public focusYamlEditor(): void {
    this._cardEditorEl?.focusYamlEditor();
  }

  protected override render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const selected = this._selectedCard;
    const cards = this._config.cards;
    const isGuiMode = !this._cardEditorEl || this._guiMode;
    const clipboard = readClipboard();

    return html`
      <div class="settings">
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${CARD_SCHEMA}
          .computeLabel=${computeLabel}
          @value-changed=${this._handleValueChanged}
        ></ha-form>
        <ha-form
          .hass=${this.hass}
          .data=${{
            width: getTilePopupSectionWidthCount(this._config.width),
          }}
          .schema=${CARD_WIDTH_SCHEMA}
          .computeLabel=${computeLabel}
          .computeHelper=${computeHelper}
          @value-changed=${this._handleWidthValueChanged}
        ></ha-form>
      </div>
      <div class="card-config">
        <div class="toolbar">
          <ha-tab-group @wa-tab-show=${this._handleSelectedCard}>
            ${cards.map(
              (_card, index) => html`
                <ha-tab-group-tab
                  slot="nav"
                  .panel=${index}
                  .active=${index === selected}
                >
                  ${index + 1}
                </ha-tab-group-tab>
              `
            )}
          </ha-tab-group>
          <ha-icon-button
            .path=${mdiPlus}
            label="Add card"
            @click=${this._handleAddCard}
          ></ha-icon-button>
        </div>

        <div id="editor">
          ${selected < cards.length
            ? html`
                <div id="card-options">
                  <ha-icon-button
                    class="gui-mode-button"
                    .disabled=${!this._guiModeAvailable}
                    .label=${isGuiMode
                      ? "Show code editor"
                      : "Show visual editor"}
                    .path=${isGuiMode ? mdiCodeBraces : mdiListBoxOutline}
                    @click=${this._toggleMode}
                  ></ha-icon-button>
                  <ha-icon-button-arrow-prev
                    .disabled=${selected === 0}
                    .label=${"Move before"}
                    .move=${-1}
                    @click=${this._handleMove}
                  ></ha-icon-button-arrow-prev>
                  <ha-icon-button-arrow-next
                    .disabled=${selected === cards.length - 1}
                    .label=${"Move after"}
                    .move=${1}
                    @click=${this._handleMove}
                  ></ha-icon-button-arrow-next>
                  <ha-icon-button
                    .label=${"Copy"}
                    .path=${mdiContentCopy}
                    @click=${this._handleCopyCard}
                  ></ha-icon-button>
                  <ha-icon-button
                    .label=${"Cut"}
                    .path=${mdiContentCut}
                    @click=${this._handleCutCard}
                  ></ha-icon-button>
                  <ha-icon-button
                    .label=${"Delete"}
                    .path=${mdiDelete}
                    @click=${this._handleDeleteCard}
                  ></ha-icon-button>
                </div>
                ${keyed(
                  this._getKey(cards, selected),
                  html`
                    <hui-card-element-editor
                      .hass=${this.hass}
                      .value=${cards[selected]}
                      .lovelace=${this.lovelace}
                      @config-changed=${this._handleConfigChanged}
                      @GUImode-changed=${this._handleGUIModeChanged}
                    ></hui-card-element-editor>
                  `
                )}
              `
            : html`
                <tile-popup-card-picker
                  .hass=${this.hass}
                  .suggestedCards=${clipboard ? [clipboard.type] : undefined}
                  @config-changed=${this._handleCardPicked}
                ></tile-popup-card-picker>
              `}
        </div>
      </div>
    `;
  }

  private _getKey(cards: LovelaceCardConfig[], index: number): string {
    const key = `${index}-${cards.length}`;

    if (!this._keys.has(key)) {
      this._keys.set(key, Math.random().toString());
    }

    return this._keys.get(key)!;
  }

  private _handleValueChanged(ev: HaFormValueChangedEvent): void {
    if (!this._config) {
      return;
    }

    const config = {
      ...this._config,
      ...ev.detail.value,
      cards: this._config.cards,
    } satisfies TilePopupConfig;

    this._config = config;
    emitConfigChanged(this, config);
  }

  private _handleWidthValueChanged(ev: HaFormValueChangedEvent): void {
    if (!this._config) {
      return;
    }

    const width = ev.detail.value.width;

    if (typeof width !== "number") {
      return;
    }

    const config = {
      ...this._config,
      width,
    } satisfies TilePopupConfig;

    this._config = config;
    emitConfigChanged(this, config);
  }

  private _handleAddCard(): void {
    if (!this._config) {
      return;
    }

    this._selectedCard = this._config.cards.length;
  }

  private _handleSelectedCard(ev: TabChangedEvent): void {
    this._guiMode = true;
    this._guiModeAvailable = true;
    this._selectedCard = Number(ev.detail.name);
  }

  private _handleConfigChanged(ev: ConfigChangedEvent): void {
    ev.stopPropagation();

    if (!this._config) {
      return;
    }

    const cards = [...this._config.cards];
    cards[this._selectedCard] = ev.detail.config;

    const config = {
      ...this._config,
      cards,
    };

    this._config = config;
    this._guiModeAvailable = ev.detail.guiModeAvailable ?? true;
    emitConfigChanged(this, config);
  }

  private _handleCardPicked(ev: ConfigChangedEvent): void {
    ev.stopPropagation();

    if (!this._config) {
      return;
    }

    const config = {
      ...this._config,
      cards: [...this._config.cards, ev.detail.config],
    };

    this._config = config;
    this._selectedCard = config.cards.length - 1;
    this._keys.clear();
    emitConfigChanged(this, config);
  }

  private _handleCopyCard(): void {
    if (!this._config) {
      return;
    }

    writeClipboard(cloneCardConfig(this._config.cards[this._selectedCard]));
  }

  private _handleCutCard(): void {
    this._handleCopyCard();
    this._handleDeleteCard();
  }

  private _handleDeleteCard(): void {
    if (!this._config) {
      return;
    }

    const cards = [...this._config.cards];
    cards.splice(this._selectedCard, 1);

    const config = {
      ...this._config,
      cards,
    };

    this._config = config;
    this._selectedCard = Math.min(this._selectedCard, Math.max(cards.length - 1, 0));
    this._keys.clear();
    emitConfigChanged(this, config);
  }

  private _handleMove(ev: Event): void {
    if (!this._config) {
      return;
    }

    const move = (ev.currentTarget as MoveButton).move;
    const source = this._selectedCard;
    const target = source + move;

    if (target < 0 || target >= this._config.cards.length) {
      return;
    }

    const cards = [...this._config.cards];
    const [card] = cards.splice(source, 1);
    cards.splice(target, 0, card);

    const config = {
      ...this._config,
      cards,
    };

    this._config = config;
    this._selectedCard = target;
    this._keys.clear();
    emitConfigChanged(this, config);
  }

  private _handleGUIModeChanged(ev: GUIModeChangedEvent): void {
    ev.stopPropagation();
    this._guiMode = ev.detail.guiMode;
    this._guiModeAvailable = ev.detail.guiModeAvailable;
  }

  private _toggleMode(): void {
    this._cardEditorEl?.toggleMode();
  }

  static get styles(): CSSResultGroup {
    return css`
      .settings {
        display: grid;
        gap: var(--ha-space-4);
        padding: 0 12px 12px;
      }

      .card-config {
        overflow: auto;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      ha-tab-group {
        flex-grow: 1;
        min-width: 0;
        --ha-tab-track-color: var(--card-background-color);
      }

      #editor {
        border: 1px solid var(--divider-color);
        padding: 12px;
      }
      #card-options {
        display: flex;
        justify-content: flex-end;
        width: 100%;
      }

      .gui-mode-button {
        margin-inline-end: auto;
        margin-inline-start: initial;
      }

      @media (max-width: 450px) {
        #editor {
          margin: 0 -12px;
        }
      }
    `;
  }
}

export const ensureTilePopupEditor = async (): Promise<void> => {
  await customElements.whenDefined("ha-form");
  await customElements.whenDefined("hui-card-element-editor");
};
