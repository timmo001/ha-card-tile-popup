import { createRequire } from "node:module";
import { defineConfig } from "rolldown";
import {
  getBabelInputPlugin,
  getBabelOutputPlugin,
} from "@rollup/plugin-babel";
import serve from "rollup-plugin-serve";
import ignore from "./rollup-plugins/rollup-ignore-plugin.mjs";

const require = createRequire(import.meta.url);

const IGNORED_FILES = [
  "@material/mwc-ripple/mwc-ripple.js",
];

const serveOptions = {
  contentBase: ["./dist"],
  host: "0.0.0.0",
  port: 4000,
  allowCrossOrigin: true,
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
};

export default defineConfig(({ watch }) => {
  const plugins = [
    ignore({
      files: IGNORED_FILES.map((file) => require.resolve(file)),
    }),
    getBabelInputPlugin({
      babelHelpers: "bundled",
    }),
    getBabelOutputPlugin({
      presets: [
        [
          "@babel/preset-env",
          {
            modules: false,
          },
        ],
      ],
      compact: true,
    }),
    ...(watch ? [serve(serveOptions)] : []),
  ];

  return {
    input: "src/card/tile-popup.ts",
    tsconfig: "./tsconfig.json",
    output: {
      dir: "dist",
      format: "es",
      codeSplitting: false,
      minify: !watch,
    },
    plugins,
    moduleContext: (id) => {
      const thisAsWindowForModules = [
        "node_modules/@formatjs/intl-utils/lib/src/diff.js",
        "node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js",
      ];
      if (thisAsWindowForModules.some((id_) => id.trimRight().endsWith(id_))) {
        return "window";
      }
    },
  };
});
