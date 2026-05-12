export interface BaseActionConfig {
  action?: string;
  confirmation?: boolean | { text?: string };
  [key: string]: any;
}

export interface ActionConfig extends BaseActionConfig {
  // Common properties can be extended here
}
