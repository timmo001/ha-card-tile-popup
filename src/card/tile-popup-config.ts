import {
  array,
  any,
  assign,
  number,
  object,
  optional,
  pattern,
  refine,
  string,
  union,
} from "superstruct";

interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

const baseLovelaceCardConfig = object({
  type: string(),
  view_layout: any(),
  layout_options: any(),
  grid_options: any(),
  visibility: any(),
  disabled: optional(any()),
});

export interface TilePopupConfig extends LovelaceCardConfig {
  label?: string;
  secondary?: string;
  icon?: string;
  icon_color?: string;
  width?: number | `${number}px`;
  cards: LovelaceCardConfig[];
}

const widthStruct = union([
  refine(number(), "width_sections", (value) =>
    Number.isInteger(value) && value >= 1 && value <= 10
  ),
  pattern(string(), /^\d+(?:\.\d+)?px$/),
]);

export const computeTilePopupPopoverWidth = (
  value: TilePopupConfig["width"]
): string | undefined => {
  if (typeof value === "number") {
    return `calc(${value} * var(--ha-view-sections-column-max-width, 500px) + ${Math.max(
      value - 1,
      0
    )} * var(--ha-view-sections-column-gap, 32px))`;
  }

  if (!value) {
    return undefined;
  }

  return /^\d+(?:\.\d+)?px$/.test(value) ? value : undefined;
};

export const getTilePopupSectionWidthCount = (
  value: TilePopupConfig["width"]
): number => {
  if (typeof value === "number") {
    return value;
  }

  return 1;
};

export const tilePopupConfigStruct = assign(
  baseLovelaceCardConfig,
  object({
    label: optional(string()),
    secondary: optional(string()),
    icon: optional(string()),
    icon_color: optional(string()),
    width: optional(widthStruct),
    cards: array(any()),
  })
);
