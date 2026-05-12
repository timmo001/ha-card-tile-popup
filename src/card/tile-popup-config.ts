import { array, any, assign, object, optional, string } from "superstruct";

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
  cards: LovelaceCardConfig[];
}

export const tilePopupConfigStruct = assign(
  baseLovelaceCardConfig,
  object({
    label: optional(string()),
    secondary: optional(string()),
    icon: optional(string()),
    cards: array(any()),
  })
);
