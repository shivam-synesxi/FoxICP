import { defineConfig } from "vite"
import reactRefresh from "@vitejs/plugin-react-refresh"
import path from "path"
import dfxJson from "./dfx.json"
import fs from "fs"

const isDev = process.env["DFX_NETWORK"] !== "ic"

type Network = "ic" | "local"

interface CanisterIds {
  [key: string]: { [key in Network]: string }
}

let canisterIds: CanisterIds | undefined
try {
  canisterIds = JSON.parse(
    fs.readFileSync("../../configs/foxic_factory.json").toString(),
  )
} catch (e) {
  console.error("\n⚠️  Before starting the dev server run: dfx deploy\n\n")
}

// List of all aliases for canisters
// This will allow us to: import { canisterName } from "canisters/canisterName"
const aliases = Object.entries(dfxJson.canisters).reduce(
  (acc, [name, _value]) => {
    // Get the network name, or `local` by default.
    const networkName = process.env["DFX_NETWORK"] || "local"
    const outputRoot = path.join(
      __dirname,
      ".dfx",
      networkName,
      "canisters",
      name,
    )

    return {
      ...acc,
      ["canisters/" + name]: path.join(outputRoot, "index" + ".js"),
    }
  },
  {},
)

console.log(canisterIds)
// Generate canister ids, required by the generated canister code in .dfx/local/canisters/*
// This strange way of JSON.stringifying the value is required by vite
// const canisterDefinitions = Object.entries(canisterIds).reduce(
//   (acc, [key, val]) => ({
//     ...acc,
//     [`process.env.${key.toUpperCase()}_CANISTER_ID`]: isDev
//       ? JSON.stringify(val.local)
//       : JSON.stringify(val.ic),
//   }),
//   {},
// )

// Gets the port dfx is running on from dfx.json
const DFX_PORT = dfxJson.networks.local.bind.split(":")[1]

// See guide on how to configure Vite at:
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  resolve: {
    alias: {
      // Here we tell Vite the "fake" modules that we want to define
      ...aliases,
    },
  },
  server: {
    fs: {
      allow: ["."],
    },
    proxy: {
      // This proxies all http requests made to /api to our running dfx instance
      "/api": {
        target: `http://localhost:${DFX_PORT}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
  },
  build: {
    target: "esnext",
  },
  define: {
    // Here we can define global constants
    // This is required for now because the code generated by dfx relies on process.env being set
    // ...canisterDefinitions,
    "process.env.factoryCanisterId": isDev
      ? JSON.stringify(canisterIds!["LOCAL_CANISTERID"])
      : JSON.stringify(canisterIds!["PRODUCTION_CANISTERID"]),
    "process.env.NODE_ENV": JSON.stringify(
      isDev ? "development" : "production",
    ),
  },
})
