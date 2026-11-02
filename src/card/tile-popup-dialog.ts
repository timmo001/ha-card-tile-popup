import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { computeCardGridSize } from "../../vendor/home-assistant-frontend/src/panels/lovelace/common/compute-card-grid-size";
import {
  computeTilePopupPopoverWidth,
  type TilePopupConfig,
} from "./tile-popup-config";

type HomeAssistant = object;

interface LovelaceGridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

interface LovelaceCardConfig {
  type: string;
  grid_options?: LovelaceGridOptions;
}

interface LovelaceCardElement extends HTMLElement {
  hass?: HomeAssistant;
  layout?: string;
  getGridOptions?(): LovelaceGridOptions | undefined;
}

interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): LovelaceCardElement;
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<CardHelpers>;
  }
}

const NARROW_MEDIA_QUERY = "(max-width: 870px), all and (max-height: 870px)";

type WaPopoverElement = HTMLElement & {
  anchor: Element | null;
};

@customElement("tile-popup-dialog")
export class TilePopupDialog extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public cards: LovelaceCardConfig[] = [];

  @property({ attribute: false }) public anchor?: Element;

  @property({ attribute: false }) public width?: TilePopupConfig["width"];

  @query("wa-popover") private _popover?: WaPopoverElement;

  @state() private _narrow = false;

  @state() private _open = true;

  @state() private _popoverOpen = false;

  @state() private _cardElements: LovelaceCardElement[] = [];

  private _unsubMediaQuery?: () => void;

  private _openPopoverAnimationFrame?: number;

  private _locationPath?: string;

  connectedCallback() {
    super.connectedCallback();
    const mql = window.matchMedia(NARROW_MEDIA_QUERY);
    this._narrow = mql.matches;

    const handler = (ev: MediaQueryListEvent) => {
      this._narrow = ev.matches;
    };

    mql.addEventListener("change", handler);
    this._unsubMediaQuery = () => mql.removeEventListener("change", handler);

    this.addEventListener("hass-more-info", this._forwardEvent);
    this.addEventListener("location-changed", this._handleNavigate);
    window.addEventListener("popstate", this._handleNavigate);
    window.addEventListener("location-changed", this._handleNavigate);
    this._locationPath = window.location.pathname;
  }

  disconnectedCallback() {
    this._cancelScheduledPopoverOpen();
    this._unsubMediaQuery?.();
    this._unsubMediaQuery = undefined;
    this.removeEventListener("hass-more-info", this._forwardEvent);
    this.removeEventListener("location-changed", this._handleNavigate);
    window.removeEventListener("popstate", this._handleNavigate);
    window.removeEventListener("location-changed", this._handleNavigate);
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("cards")) {
      this._open = true;
      this._popoverOpen = false;
      void this._createCardElements(this.cards);
    }

    if (changedProperties.has("hass")) {
      for (const element of this._cardElements) {
        element.hass = this.hass;
      }
    }
  }

  // Built through the public card helpers rather than hui-section, which only
  // a full dashboard loads. Home Assistant's embed components define the
  // helpers but not the dashboard's section elements.
  private async _createCardElements(cards: LovelaceCardConfig[]) {
    const helpers = await window.loadCardHelpers?.();

    if (!helpers || cards !== this.cards) {
      return;
    }

    this._cardElements = cards.map((config, index) =>
      this._createCardElement(helpers, config, index)
    );
  }

  private _createCardElement(
    helpers: CardHelpers,
    config: LovelaceCardConfig,
    index: number
  ): LovelaceCardElement {
    const element = helpers.createCardElement(config);
    element.hass = this.hass;
    element.layout = "grid";

    // Custom cards that aren't defined yet start as an error card, and fire
    // ll-rebuild once they are, the same as hui-card handles.
    element.addEventListener(
      "ll-rebuild",
      (ev) => {
        ev.stopPropagation();

        if (this._cardElements[index] !== element) {
          return;
        }

        const rebuilt = this._createCardElement(helpers, config, index);
        this._cardElements = this._cardElements.map((current, i) =>
          i === index ? rebuilt : current
        );
      },
      { once: true }
    );

    element.addEventListener(
      "ll-upgrade",
      (ev) => {
        ev.stopPropagation();
        element.hass = this.hass;
        this.requestUpdate();
      },
      { once: true }
    );

    return element;
  }

  private _renderCard(element: LovelaceCardElement, index: number) {
    const { columns, rows } = computeCardGridSize({
      ...element.getGridOptions?.(),
      ...this.cards[index]?.grid_options,
    });

    return html`<div
      class=${classMap({
        card: true,
        "fit-rows": rows !== "auto",
        "full-width": columns === "full",
      })}
      style=${styleMap({
        "--column-size": columns === "full" ? null : String(columns),
        "--row-size": rows === "auto" ? null : String(rows),
      })}
    >
      ${element}
    </div>`;
  }

  protected override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("width")) {
      const popoverWidth = computeTilePopupPopoverWidth(this.width);

      if (popoverWidth !== undefined) {
        this.style.setProperty("--tile-popup-width", popoverWidth);
      } else {
        this.style.removeProperty("--tile-popup-width");
      }
    }

    if (this._presentationMode !== "popover") {
      this._cancelScheduledPopoverOpen();
      this._popoverOpen = false;

      return;
    }

    this._syncPopoverAnchor();

    if (!this._open) {
      this._cancelScheduledPopoverOpen();
      this._popoverOpen = false;

      return;
    }

    if (this._popoverOpen || this._openPopoverAnimationFrame !== undefined) {
      return;
    }

    this._openPopoverAnimationFrame = requestAnimationFrame(() => {
      this._openPopoverAnimationFrame = undefined;
      this._syncPopoverAnchor();

      if (this._open && this._presentationMode === "popover") {
        this._popoverOpen = true;
      }
    });
  }

  private _cancelScheduledPopoverOpen() {
    if (this._openPopoverAnimationFrame === undefined) {
      return;
    }

    cancelAnimationFrame(this._openPopoverAnimationFrame);
    this._openPopoverAnimationFrame = undefined;
  }

  private _syncPopoverAnchor() {
    const anchor = this.anchor ?? null;

    if (this._popover && this._popover.anchor !== anchor) {
      this._popover.anchor = anchor;
    }
  }

  private get _presentationMode(): "popover" | "bottom-sheet" {
    return this._narrow ? "bottom-sheet" : "popover";
  }

  protected override render() {
    if (!this.hass || !this.cards.length) {
      return nothing;
    }

    const presentationMode = this._presentationMode;
    const popupLabel = "Popup";

    const content = html`<div class="cards">
      ${this._cardElements.map((element, index) =>
        this._renderCard(element, index)
      )}
    </div>`;

    if (presentationMode === "bottom-sheet") {
      return html`<ha-bottom-sheet
        .open=${this._open}
        flexContent
        aria-label=${popupLabel}
        @closed=${this._handleBottomSheetClosed}
      >
        <div class="bottom-sheet-surface">${content}</div>
      </ha-bottom-sheet>`;
    }

    return html`<wa-popover
      .open=${this._popoverOpen}
      .anchor=${this.anchor ?? null}
      auto-size="vertical"
      auto-size-padding="16"
      placement="bottom"
      without-arrow
      trap-focus
      role="dialog"
      aria-modal="true"
      aria-label=${popupLabel}
      @wa-show=${this._handlePopoverShow}
      @wa-hide=${this._handlePopoverHide}
      @wa-after-hide=${this._handlePopoverAfterHide}
    >
      <div class="popover-surface">${content}</div>
    </wa-popover>`;
  }

  private _handlePopoverShow = (ev: Event) => {
    if (ev.eventPhase === Event.AT_TARGET) {
      this._open = true;
    }
  };

  private _handlePopoverHide = (ev: Event) => {
    if (ev.eventPhase !== Event.AT_TARGET) {
      return;
    }

    // Prevent the popover from closing if a more-info dialog is actively open
    const ha = document.querySelector("home-assistant");

    const moreInfoDialog = ha?.shadowRoot?.querySelector("ha-more-info-dialog");

    if (moreInfoDialog?.shadowRoot?.children.length) {
      ev.preventDefault();
    }
  };

  private _handlePopoverAfterHide = (ev: Event) => {
    if (ev.eventPhase !== Event.AT_TARGET) {
      return;
    }

    this._open = false;
    this._popoverOpen = false;
    this.dispatchEvent(new CustomEvent("closed"));
  };

  private _handleBottomSheetClosed = (ev: Event) => {
    if (ev.eventPhase !== Event.AT_TARGET) {
      return;
    }

    this._open = false;
    this._popoverOpen = false;
    this.dispatchEvent(new CustomEvent("closed"));
  };

  private _forwardEvent = (ev: Event) => {
    ev.stopPropagation();
    const ha = document.querySelector("home-assistant");

    if (ha) {
      ha.dispatchEvent(
        new CustomEvent(ev.type, {
          bubbles: true,
          composed: true,
          // Home Assistant's fireEvent dispatches a plain Event with detail
          // added, not a CustomEvent
          detail: "detail" in ev ? ev.detail : undefined,
        })
      );
    }
  };

  private _handleNavigate = (ev: Event) => {
    // Only close on actual path changes, not query param updates (e.g. more-info dialog)
    if (window.location.pathname === this._locationPath) {
      return;
    }

    if (ev.type === "location-changed") {
      ev.stopPropagation();
      const ha = document.querySelector("home-assistant");

      if (ha) {
        ha.dispatchEvent(
          new CustomEvent(ev.type, {
            bubbles: true,
            composed: true,
            detail: "detail" in ev ? ev.detail : undefined,
          })
        );
      }
    }

    this._open = false;
    this._popoverOpen = false;
    this.dispatchEvent(new CustomEvent("closed"));
  };

  static styles = css`
    ha-bottom-sheet {
      --dialog-content-padding: 0;
      --ha-bottom-sheet-height: calc(100dvh - var(--ha-space-12));
      --ha-bottom-sheet-max-height: var(--ha-bottom-sheet-height);
      --ha-bottom-sheet-padding: 0;
      --ha-bottom-sheet-content-padding: 0;
    }

    wa-popover {
      --width: min(
        var(
          --tile-popup-width,
          calc(
            1 * var(--ha-view-sections-column-max-width, 500px) + 0 *
              var(--ha-view-sections-column-gap, 32px)
          )
        ),
        95vw
      );
      --wa-color-surface-raised: var(
        --ha-dialog-surface-background,
        var(--card-background-color, var(--ha-color-surface-default))
      );
      --wa-panel-border-radius: var(
        --ha-dialog-border-radius,
        var(--ha-border-radius-3xl)
      );
    }

    wa-popover::part(dialog)::backdrop {
      background: none;
    }

    wa-popover::part(body) {
      padding: 0;
      border-color: transparent;
      box-shadow: var(--dialog-box-shadow, var(--wa-shadow-l));
      min-width: var(--width);
      max-width: var(--width);
      max-height: calc(var(--safe-height, 100vh) - var(--ha-space-20, 80px));
      overflow: hidden;
      color: var(--primary-text-color);
    }

    .popover-surface {
      display: flex;
      flex-direction: column;
      max-height: inherit;
      overflow: auto;
      padding: var(--ha-space-4);
    }

    .bottom-sheet-surface {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      min-height: 0;
      max-height: inherit;
      overflow: auto;
      padding: var(--ha-space-4);
    }

    /* The layout of a sections dashboard's grid section */
    .cards {
      --row-gap: var(--ha-section-grid-row-gap, 8px);
      --column-gap: var(--ha-section-grid-column-gap, 8px);
      --row-height: var(--ha-section-grid-row-height, 56px);
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: auto;
      row-gap: var(--row-gap);
      column-gap: var(--column-gap);
      width: 100%;
    }

    .card {
      position: relative;
      grid-row: span var(--row-size, 1);
      grid-column: span min(var(--column-size, 1), 12);
      border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
    }

    .card.fit-rows {
      height: calc(
        (var(--row-size, 1) * (var(--row-height) + var(--row-gap))) - var(
            --row-gap
          )
      );
    }

    .card.full-width {
      grid-column: 1 / -1;
    }

    .card > * {
      display: block;
      height: 100%;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "tile-popup-dialog": TilePopupDialog;
  }
}
