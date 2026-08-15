import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  buildFleetPaneUrl,
  normalizeFleetUrl,
  osc52ClipboardSequence,
  popupOpenArgs,
  runCopyAction,
  runCopyPopup,
  sessionNameFromRuntime,
} from "./pane-url.ts";

const config = {
  HERDR_WEB_FLEET_URL: "https://herdr.example.com/",
  HERDR_WEB_INSTANCE_ID: "cluster-a",
};
const loadConfig = async () => config;
const pluginRoot = join(import.meta.dir, "..");

describe("focused Pane Fleet URL", () => {
  test("builds the primary-session canonical outer route", () => {
    expect(
      buildFleetPaneUrl({
        fleetUrl: "https://herdr.example.com",
        instanceId: "cluster-a",
        spaceId: "w0",
        tabId: "w0:t2",
        paneId: "w0:p3",
      }),
    ).toBe("https://herdr.example.com/?instance=cluster-a&space=w0&tab=w0%3At2&pane=w0%3Ap3");
  });

  test("encodes a named session after the instance and Pane selectors", () => {
    expect(
      buildFleetPaneUrl({
        fleetUrl: "https://herdr.example.com/",
        instanceId: "cluster-a",
        spaceId: "w0",
        tabId: "w0:t2",
        paneId: "w0:p3",
        session: "research / 中文",
      }),
    ).toBe(
      "https://herdr.example.com/?instance=cluster-a&space=w0&tab=w0%3At2&pane=w0%3Ap3&session=research+%2F+%E4%B8%AD%E6%96%87",
    );
  });

  test("accepts only an HTTPS origin root and bounded route selectors", () => {
    expect(normalizeFleetUrl("https://herdr.example.com:8443")).toBe("https://herdr.example.com:8443/");
    for (const fleetUrl of [
      "http://herdr.example.com/",
      "https://user@herdr.example.com/",
      "https://herdr.example.com/fleet",
      "https://herdr.example.com/?x=1",
      "https://herdr.example.com/#x",
    ]) {
      expect(() =>
        buildFleetPaneUrl({ fleetUrl, instanceId: "cluster-a", spaceId: "w0", tabId: "w0:t2", paneId: "w0:p3" }),
      ).toThrow();
    }
    expect(() =>
      buildFleetPaneUrl({ fleetUrl: config.HERDR_WEB_FLEET_URL, instanceId: "Cluster A", spaceId: "w0", tabId: "w0:t2", paneId: "w0:p3" }),
    ).toThrow("instance id");
    expect(() =>
      buildFleetPaneUrl({ fleetUrl: config.HERDR_WEB_FLEET_URL, instanceId: "cluster-a", spaceId: "w0", tabId: "w0:t2", paneId: "../p3" }),
    ).toThrow("Pane id");
    expect(() =>
      buildFleetPaneUrl({
        fleetUrl: config.HERDR_WEB_FLEET_URL,
        instanceId: "cluster-a",
        spaceId: "w0",
        tabId: "w0:t2",
        paneId: "w0:p3",
        session: "bad\nsession",
      }),
    ).toThrow("session name");
  });

  test("prefers explicit session identity and otherwise recognizes only the standard socket layout", () => {
    expect(
      sessionNameFromRuntime({
        HERDR_SESSION: "cluster-user",
        HERDR_SOCKET_PATH: "/tmp/relocated.sock",
      }),
    ).toBe("cluster-user");
    expect(sessionNameFromRuntime({ HERDR_SESSION: "default" })).toBeUndefined();
    expect(
      sessionNameFromRuntime({ HERDR_SOCKET_PATH: "/home/operator/.config/herdr/sessions/demo/herdr.sock" }),
    ).toBe("demo");
    expect(sessionNameFromRuntime({ HERDR_SOCKET_PATH: "/tmp/relocated.sock" })).toBeUndefined();
    expect(() => sessionNameFromRuntime({ HERDR_SESSION: "bad\u0007session" })).toThrow("session name");
  });
});

describe("Pane URL clipboard bridge", () => {
  test("keeps the manifest, public environment, and portable binding in sync", async () => {
    const manifest = await Bun.file(join(pluginRoot, "herdr-plugin.toml")).text();
    expect(manifest).toContain('id = "copy-pane-url"');
    expect(manifest).toContain('contexts = ["pane"]');
    expect(manifest).toContain('placement = "popup"');
    expect(manifest).toContain('command = ["bash", "scripts/pane-url.sh", "copy"]');

    const example = await Bun.file(join(pluginRoot, ".env.example")).text();
    expect(example).toContain("HERDR_WEB_FLEET_URL=https://herdr.example.com/");
    expect(example).toContain("HERDR_WEB_INSTANCE_ID=local");

    const readme = await Bun.file(join(pluginRoot, "README.md")).text();
    expect(readme).toContain('key = "prefix+ctrl+r"');
    expect(readme).toContain('command = "memset0.web-remote.copy-pane-url"');
  });

  test("opens the registered popup with validated plugin-namespaced context", () => {
    expect(popupOpenArgs("w0", "w0:t2", "w0:p3", "demo")).toEqual([
      "plugin",
      "pane",
      "open",
      "--plugin",
      "memset0.web-remote",
      "--entrypoint",
      "copy-pane-url",
      "--placement",
      "popup",
      "--env",
      "HERDR_WEB_REMOTE_TARGET_SPACE=w0",
      "--env",
      "HERDR_WEB_REMOTE_TARGET_TAB=w0:t2",
      "--env",
      "HERDR_WEB_REMOTE_TARGET_PANE=w0:p3",
      "--env",
      "HERDR_WEB_REMOTE_TARGET_SESSION=demo",
    ]);
  });

  test("preflights public configuration before invoking Herdr", async () => {
    let invocation: { binary: string; args: string[] } | undefined;
    await runCopyAction(
      {
        HERDR_BIN_PATH: "/opt/herdr/bin/herdr",
        HERDR_WORKSPACE_ID: "w0",
        HERDR_TAB_ID: "w0:t2",
        HERDR_PANE_ID: "w0:p3",
        HERDR_PLUGIN_CONFIG_DIR: "/synthetic/config",
        HERDR_SESSION: "demo",
      },
      (binary, args) => {
        invocation = { binary, args };
        return { status: 0 };
      },
      loadConfig,
    );
    expect(invocation).toEqual({
      binary: "/opt/herdr/bin/herdr",
      args: popupOpenArgs("w0", "w0:t2", "w0:p3", "demo"),
    });

    let ran = false;
    await expect(
      runCopyAction(
        {
          HERDR_WORKSPACE_ID: "w0",
          HERDR_TAB_ID: "w0:t2",
          HERDR_PANE_ID: "w0:p3",
          HERDR_PLUGIN_CONFIG_DIR: "/synthetic/config",
        },
        () => {
          ran = true;
          return { status: 0 };
        },
        async () => {
          throw new Error("synthetic-secret-must-not-surface");
        },
      ),
    ).rejects.toThrow("protected plugin configuration could not be read");
    expect(ran).toBeFalse();
  });

  test("emits exactly one OSC 52 clipboard write and drains before exit", async () => {
    const calls: string[] = [];
    const url = await runCopyPopup(
      {
        HERDR_PLUGIN_CONFIG_DIR: "/synthetic/config",
        HERDR_WEB_REMOTE_TARGET_SPACE: "w0",
        HERDR_WEB_REMOTE_TARGET_TAB: "w0:t2",
        HERDR_WEB_REMOTE_TARGET_PANE: "w0:p3",
        HERDR_WEB_REMOTE_TARGET_SESSION: "demo",
      },
      (value) => {
        calls.push(value);
      },
      async () => {
        calls.push("drained");
      },
      loadConfig,
    );
    expect(url).toBe(
      "https://herdr.example.com/?instance=cluster-a&space=w0&tab=w0%3At2&pane=w0%3Ap3&session=demo",
    );
    expect(calls).toEqual([osc52ClipboardSequence(url), "drained"]);

    const encoded = calls[0]!.slice("\u001b]52;c;".length, -1);
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe(url);
  });

  test("copies nothing when popup context or public configuration is invalid", async () => {
    const calls: string[] = [];
    await expect(
      runCopyPopup(
        {
          HERDR_PLUGIN_CONFIG_DIR: "/synthetic/config",
          HERDR_WEB_REMOTE_TARGET_SPACE: "w0",
          HERDR_WEB_REMOTE_TARGET_TAB: "w0:t2",
          HERDR_WEB_REMOTE_TARGET_PANE: "bad pane",
        },
        (value) => {
          calls.push(value);
        },
        async () => {},
        loadConfig,
      ),
    ).rejects.toThrow("Pane id");
    expect(calls).toEqual([]);
  });
});
