#!/usr/bin/env node
/**
 * Thin wrapper so `.claude/launch.json` can start the dev server with the
 * env vars this isolated test copy needs, without depending on shell syntax
 * (bash vs PowerShell) at the launch-config level.
 *
 *   PORT              - Studio port (matches the whole session's convention: 3200)
 *   HERMES_STATE_DIR  - keeps Studio settings (gateway url/token/adapterType)
 *                       inside this isolated copy's .state/, never touching
 *                       any real user home directory.
 */
"use strict";

process.env.PORT = process.env.PORT || "3200";
process.env.HERMES_STATE_DIR =
  process.env.HERMES_STATE_DIR || require("path").join(__dirname, "..", ".state");

require("../server/index.js");
