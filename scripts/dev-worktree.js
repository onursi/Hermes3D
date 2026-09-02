#!/usr/bin/env node
/**
 * Worktree-local variant of dev-with-env.js — hardcodes PORT 3201 (not the
 * whole session's 3200 convention) and its own isolated HERMES_STATE_DIR,
 * so this worktree's dev server never collides with the main checkout's
 * (which another tool — Antigravity — may be actively running/using).
 */
"use strict";

process.env.PORT = "3201";
process.env.HERMES_STATE_DIR = require("path").join(__dirname, "..", ".state");

require("../server/index.js");
