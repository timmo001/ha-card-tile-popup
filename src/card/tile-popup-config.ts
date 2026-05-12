import { array, any, assign, object, optional, string } from "superstruct";
import type { LovelaceCardConfig } from "../ha";
import { lovelaceCardConfigStruct } from "../shared/config/lovelace-card-config";

export interface TilePopupConfig extends LovelaceCardConfig {
  label?: string;
  secondary?: string;
  icon?: string;
  cards: LovelaceCardConfig[];
}

export const tilePopupConfigStruct = assign(
  lovelaceCardConfigStruct,
  object({
    label: optional(string()),
    secondary: optional(string()),
    icon: optional(string()),
    cards: array(any()),
  })
);
