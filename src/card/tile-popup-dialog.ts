import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface HomeAssistant {
  [key: string]: unknown;
}

interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
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

  @state() private _narrow = false;

  @state() private _open = true;

  @state() private _popoverOpen = false;

  private _unsubMediaQuery?: () => void;

  private _openPopoverAnimationFrame?: number;

  connectedCallback() {
    super.connectedCallback();
    const mql = window.matchMedia(NARROW_MEDIA_QUERY);
    this._narrow = mql.matches;
    const handler = (ev: MediaQueryListEvent) => {
      this._narrow = ev.matches;
    };
    mql.addEventListener("change", handler);
    this._unsubMediaQuery = () => mql.removeEventListener("change", handler);
  }

  disconnectedCallback() {
    this._cancelScheduledPopoverOpen();
    this._unsubMediaQuery?.();
    this._unsubMediaQuery = undefined;
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("cards")) {
      this._open = true;
      this._popoverOpen = false;
    }
  }

  protected override updated() {
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
    const popover =
      this.renderRoot.querySelector<WaPopoverElement>("wa-popover");
    const anchor = this.anchor ?? null;
    if (popover && popover.anchor !== anchor) {
      popover.anchor = anchor;
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

    const content = html`<hui-section
      .hass=${this.hass}
      .config=${{ cards: this.cards }}
      .index=${0}
      .viewIndex=${0}
      import-only
    ></hui-section>`;

    if (presentationMode === "bottom-sheet") {
      return html`<ha-bottom-sheet
        .open=${this._open}
        aria-label=${popupLabel}
        @closed=${this._handleBottomSheetClosed}
      >${content}</ha-bottom-sheet>`;
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
      @wa-after-hide=${this._handlePopoverAfterHide}
    >
      <div class="popover-surface">${content}</div>
    </wa-popover>`;
  }

  private _handlePopoverShow(ev: Event) {
    if (ev.eventPhase === Event.AT_TARGET) {
      this._open = true;
    }
  }

  private _handlePopoverAfterHide(ev: Event) {
    if (ev.eventPhase !== Event.AT_TARGET) {
      return;
    }
    this._open = false;
    this._popoverOpen = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  private _handleBottomSheetClosed() {
    this._open = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  static styles = css`
    ha-bottom-sheet {
      --dialog-content-padding: var(--ha-space-4);
      --ha-bottom-sheet-content-padding: var(--ha-space-4);
    }

    wa-popover {
      --width: min(
        calc(var(--ha-view-sections-column-max-width, 500px) + 2 * var(--ha-space-4)),
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

    hui-section {
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "tile-popup-dialog": TilePopupDialog;
  }
}
