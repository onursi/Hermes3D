/**
 * The A/B acceptance checks, run against the running V2.
 *
 * Section B names them: a real source survives the round trip, repeated
 * journeys do not duplicate listeners, and no second scene keeps running.
 * Each is checked by observation rather than by assertion in the code that
 * would be doing the thing — a test that asks the implementation whether it
 * worked is not a test.
 */
import { chromium } from "playwright";

const AT = (label, ok, detail) =>
  console.log(`${ok ? "OK  " : "FEHL"}  ${label}${detail ? "  — " + detail : ""}`);

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1250 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

  await page.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(13000);
  await page.getByLabel("Entwicklerwerte").click().catch(() => {});

  // --- Jarvis: a real question with real sources ----------------------------
  await page.getByRole("button", { name: /jarvis/i }).first().click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/Was denke ich/i).first().fill("Was ist das Zielbild von Hermes 3D?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(10000);

  const sourceCount = await page.locator("text=/^\\[\\d\\]$/").count().catch(() => 0);
  AT("Jarvis liefert Quellen", sourceCount > 0, sourceCount + " Quellen");

  const selectedBefore = await page
    .locator("aside")
    .filter({ hasText: "QUELLE" })
    .first()
    .textContent()
    .catch(() => null);
  AT("Quelle ist ausgewählt", Boolean(selectedBefore), (selectedBefore || "").slice(0, 46));

  // --- Round trip: home -> cosmos -> home -----------------------------------
  const canvasesBefore = await page.locator("canvas").count();

  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(6000);
  const inCosmos = await page.locator("header").first().textContent();
  AT("Reise in den Kosmos", /Wissenskosmos/.test(inCosmos || ""), (inCosmos || "").slice(0, 30));

  await page.getByRole("button", { name: /zuhause/i }).first().click();
  await page.waitForTimeout(6000);
  const backHome = await page.locator("header").first().textContent();
  AT("Rückkehr nach Hause", /Kommandodeck/.test(backHome || ""), (backHome || "").slice(0, 30));

  const selectedAfter = await page
    .locator("aside")
    .filter({ hasText: "QUELLE" })
    .first()
    .textContent()
    .catch(() => null);
  AT(
    "Auswahl überlebt die Reise",
    Boolean(selectedAfter) && selectedAfter === selectedBefore,
    (selectedAfter || "keine").slice(0, 46),
  );

  // --- Second round trip: no leaks -----------------------------------------
  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: /zuhause/i }).first().click();
  await page.waitForTimeout(4500);

  const canvasesAfter = await page.locator("canvas").count();
  AT(
    "Keine zweite Szene nach zwei Reisen",
    canvasesAfter === canvasesBefore,
    `${canvasesBefore} → ${canvasesAfter} Canvas`,
  );

  // --- Escape returns home --------------------------------------------------
  await page.keyboard.press("Escape"); // closes the inspector
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(4500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(4000);
  const afterEscape = await page.locator("header").first().textContent();
  AT("Escape führt heim", /Kommandodeck/.test(afterEscape || ""), (afterEscape || "").slice(0, 30));

  // --- Section C: the search ------------------------------------------------
  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(4500);

  const searchBox = page.getByPlaceholder(/Notiz oder Ordner suchen/i).first();
  const searchVisible = await searchBox.isVisible().catch(() => false);
  AT("Suchfeld erscheint im Kosmos", searchVisible);

  await searchBox.fill("hermes");
  await page.waitForTimeout(900);
  const resultLine = await page
    .locator("text=/\\d+ Treffer|kein Treffer/")
    .first()
    .textContent()
    .catch(() => null);
  const hits = Number((resultLine || "").match(/(\d+) Treffer/)?.[1] ?? 0);
  AT("Suche findet echte Notizen", hits > 0, resultLine || "keine Anzeige");

  // Picking a result must select it — the map answers, not just the list.
  // Addressed through the search field itself rather than by guessing at the
  // DOM: the results are the buttons that follow it inside the same panel.
  await searchBox
    .locator("xpath=ancestor::div[2]")
    .locator("button")
    .filter({ hasNotText: "×" })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(900);
  const pickedPanel = await page
    .locator("aside")
    .filter({ hasText: "QUELLE" })
    .first()
    .textContent()
    .catch(() => null);
  AT("Treffer auswählbar", Boolean(pickedPanel), (pickedPanel || "keine").slice(0, 40));

  // Escape inside the field clears the search rather than doing nothing.
  await searchBox.click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const cleared = await searchBox.inputValue().catch(() => "x");
  AT("Escape leert die Suche", cleared === "", `Feld: "${cleared}"`);

  // --- Section C: the yard ---------------------------------------------------
  await page.getByRole("button", { name: /projekte/i }).first().click();
  await page.waitForTimeout(5000);
  const inYard = await page.locator("header").first().textContent();
  AT("Reise in die Ergebniswerft", /Ergebniswerft/.test(inYard || ""), (inYard || "").slice(0, 30));

  // Not equality: the earlier baseline was taken with the Jarvis console open,
  // which contributes a canvas of its own. What must hold is that a third
  // world adds no scene — so the count may fall, never rise.
  const yardCanvases = await page.locator("canvas").count();
  AT(
    "Dritte Welt fügt keine Szene hinzu",
    yardCanvases >= 1 && yardCanvases <= canvasesBefore,
    `${canvasesBefore} → ${yardCanvases} Canvas`,
  );

  // The yard has to agree with the route it claims to draw.
  const apiProjects = await page.evaluate(async () => {
    const response = await fetch("/api/vault/projects");
    const data = await response.json();
    return (data.projects || []).map((p) => ({ folder: p.folder, notes: p.noteCount }));
  });
  AT(
    "Projekte kommen aus dem Vault",
    apiProjects.length > 0,
    apiProjects.map((p) => `${p.folder}(${p.notes})`).join(", ").slice(0, 90),
  );

  // Click the middle of the yard floor to hit a berth: the ring is centred, so
  // a click at the front-most dais lands on a project rather than on nothing.
  const box = await page.locator("canvas").first().boundingBox();
  // A grid rather than four guessed points. Where a berth lands on screen
  // depends on the viewport aspect and on how many projects the vault has, and
  // three rounds of hand-tuned coordinates only ever proved that hand-tuned
  // coordinates are the wrong tool. The scan stops at the first hit.
  const aimPoints = [];
  for (let fy = 0.42; fy <= 0.82; fy += 0.08) {
    for (let fx = 0.2; fx <= 0.8; fx += 0.075) aimPoints.push([fx, fy]);
  }
  for (const [fx, fy] of aimPoints) {
    if (!box) break;
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(320);
    const hit = await page.locator("aside").filter({ hasText: /Zuletzt bearbeitet/ }).first().isVisible().catch(() => false);
    if (hit) break;
  }
  // Filtered on the recency row, not on the word "Projekt": a source whose
  // path contains "05 Projekte" matched that and made the check pass on the
  // wrong panel — a test that can be satisfied by the thing it is not testing.
  const projectPanel = await page
    .locator("aside")
    .filter({ hasText: /Zuletzt bearbeitet/ })
    .first()
    .textContent()
    .catch(() => null);
  AT(
    "Projekt auswählbar mit echten Daten",
    Boolean(projectPanel) && /Notizen/.test(projectPanel || ""),
    (projectPanel || "keines").replace(/\s+/g, " ").slice(0, 70),
  );

  await page.getByRole("button", { name: /zuhause/i }).first().click();
  await page.waitForTimeout(4500);

  // --- Section C: approvals are legible, not just a light -------------------
  const approvalState = await page.evaluate(async () => {
    const response = await fetch("/api/approvals");
    return response.json();
  });
  const pill = await page
    .locator("text=/Freigabe|Freigaben unbekannt/")
    .first()
    .textContent()
    .catch(() => null);
  // Reachable and empty means no pill at all; unreachable or waiting means a
  // pill that can be opened. Both are correct — silently showing nothing while
  // the queue is unknown is the one outcome that is not.
  const expectPill = !approvalState.ok || (approvalState.approvals || []).length > 0;
  AT(
    "Freigaben: Anzeige entspricht der Lage",
    expectPill === Boolean(pill),
    `ok=${approvalState.ok} wartend=${(approvalState.approvals || []).length} Pille=${pill || "keine"}`,
  );

  // --- C2: the note is read here, not in Obsidian --------------------------

  // Straight at the route, before the UI: a reader that works against a broken
  // endpoint cannot exist, and a reader that fails against a working one is a
  // different bug. Separating them is the point of checking both.
  const readerApi = await page.evaluate(async () => {
    const one = await fetch(
      "/api/vault/note?id=" + encodeURIComponent("02⚙️ System/Übergabe.md"),
    ).then((r) => r.json());
    const escape = await fetch(
      "/api/vault/note?id=" + encodeURIComponent("../../../Windows/win.ini"),
    ).then((r) => r.json());
    const missing = await fetch("/api/vault/note?id=gibtesnicht.md").then((r) => r.json());
    return {
      ok: one.ok === true && typeof one.content === "string" && one.content.length > 500,
      format: one.format,
      escaped: escape.ok === false && escape.reason === "outside-vault",
      missing: missing.ok === false && missing.reason === "not-found",
    };
  });
  AT("Leser-Endpunkt liefert echten Inhalt", readerApi.ok, `format=${readerApi.format}`);
  AT("Pfadflucht wird abgewiesen", readerApi.escaped);
  AT("Fehlende Notiz ist nicht dasselbe wie leer", readerApi.missing);

  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(4000);
  await page.getByPlaceholder(/Notiz oder Ordner suchen/i).first().fill("Zielbild");
  await page.waitForTimeout(900);
  await page.locator("button", { hasText: /Zielbild/ }).first().click();
  await page.waitForTimeout(900);

  const readButton = page.getByRole("button", { name: /Notiz lesen/i }).first();
  const canRead = await readButton.isVisible().catch(() => false);
  AT("Auswahl bietet den Leser an", canRead);

  if (canRead) {
    await readButton.click();
    await page.waitForTimeout(2500);
    // A real heading from a real note, not a placeholder and not an excerpt.
    const readerText = await page
      .locator("article.prose-hermes")
      .first()
      .textContent()
      .catch(() => null);
    AT(
      "Vollständige Notiz steht im Raum",
      Boolean(readerText) && (readerText || "").length > 1500,
      `${(readerText || "").length} Zeichen`,
    );

    const neighbours = await page
      .locator("text=/Belegte Nachbarn/")
      .first()
      .textContent()
      .catch(() => null);
    AT("Belegte Nachbarn sind benannt", Boolean(neighbours), (neighbours || "keine").trim());

    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    const stillOpen = await page
      .locator("article.prose-hermes")
      .first()
      .isVisible()
      .catch(() => false);
    // Escape closes the reader and nothing else: the selection it was opened
    // from has to survive, or reading a note costs you your place.
    const selectionSurvived = await page
      .locator("aside")
      .filter({ hasText: "QUELLE" })
      .first()
      .isVisible()
      .catch(() => false);
    AT("Escape schließt nur den Leser", !stillOpen && selectionSurvived);
  }

  await page.getByPlaceholder(/Notiz oder Ordner suchen/i).first().fill("");
  await page.getByRole("button", { name: /^zuhause$/i }).first().click();
  await page.waitForTimeout(3000);

  // --- U1: the dock is a cut, and the universe is a place ------------------

  // Direct means direct: the destination is on screen before an animation of
  // any length could have finished. 400 ms against a 1150 ms warp is not a
  // close call — if this passes, nothing was flown.
  await page.getByRole("button", { name: /projekte/i }).first().click();
  await page.waitForTimeout(400);
  const quickHeader = await page.locator("header").first().textContent();
  AT(
    "Dock wechselt ohne Reise",
    /Ergebniswerft/.test(quickHeader || "") && !/unterwegs/i.test(quickHeader || ""),
    (quickHeader || "").replace(/\s+/g, " ").slice(0, 40),
  );

  await page.getByRole("button", { name: /^reisen$/i }).first().click();
  await page.waitForTimeout(3500);
  const universeHeader = await page.locator("header").first().textContent();
  AT("Reisen öffnet das Universum", /Unterwegs/.test(universeHeader || ""));

  const cockpit = await page
    .locator("text=/ZIEHEN ZUM UMSEHEN/i")
    .first()
    .isVisible()
    .catch(() => false);
  AT("Cockpit nennt die Steuerung", cockpit);

  // What the universe costs, measured where he actually stands in it.
  const flightSamples = [];
  const flightUntilMeasure = Date.now() + 6000;
  while (Date.now() < flightUntilMeasure) {
    const text = await page
      .evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("div"));
        const el = nodes.find((n) => /^\d+ fps · /.test((n.textContent || "").trim()));
        return el ? el.textContent : "";
      })
      .catch(() => "");
    const m = (text || "").match(/(\d+) fps · (\d+) Draws · (\d+)k/);
    if (m) flightSamples.push({ fps: +m[1], draws: +m[2], tri: +m[3] });
    await page.waitForTimeout(600);
  }
  if (flightSamples.length) {
    const fps = flightSamples.map((s) => s.fps).sort((a, b) => a - b);
    console.log(
      `MESSUNG Unterwegs @1720x1250: fps Median ${fps[Math.floor(fps.length / 2)]} ` +
        `(${fps[0]}–${fps[fps.length - 1]}), ${flightSamples[0].draws} Draws, ` +
        `${flightSamples[0].tri}k Dreiecke, ${flightSamples.length} Proben`,
    );
  }

  // Held, not tapped. A key that goes down and up between two frames is never
  // seen by the render loop, so a tap would test nothing and pass anyway.
  await page.keyboard.down("w");
  let reached = false;
  const flightUntil = Date.now() + 5000;
  while (Date.now() < flightUntil) {
    reached = await page
      .locator("text=/In Reichweite/")
      .first()
      .isVisible()
      .catch(() => false);
    if (reached) break;
    await page.waitForTimeout(120);
  }
  await page.keyboard.up("w");
  AT("Freier Flug erreicht einen Ort", reached);

  let enteredFromFlight = false;
  if (reached) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    const entered = await page.locator("header").first().textContent();
    enteredFromFlight = !/Unterwegs/.test(entered || "");
    AT("Eintritt aus dem Flug", enteredFromFlight, (entered || "").replace(/\s+/g, " ").slice(0, 30));
  }

  if (enteredFromFlight) {
    // The plan's "Eintritt/Rückkehr behalten Richtung und Position", checked
    // by its consequence rather than by reading the camera: he was within
    // reach of that place when he entered, so he must still be within reach
    // of it when he comes back out. A reset camera fails this.
    await page.getByRole("button", { name: /^reisen$/i }).first().click();
    await page.waitForTimeout(2500);
    const stillInReach = await page
      .locator("text=/In Reichweite/")
      .first()
      .isVisible()
      .catch(() => false);
    AT("Rückkehr behält die Position", stillInReach);
  }

  await page.getByRole("button", { name: /heimkehr/i }).first().click();
  await page.waitForTimeout(2500);
  const homeAgain = await page.locator("header").first().textContent();
  AT("Heimkehr aus dem Flug", /Kommandodeck/.test(homeAgain || ""));

  // --- Measurement, once it has settled ------------------------------------
  const samples = [];
  const until = Date.now() + 16000;
  while (Date.now() < until) {
    const text = await page
      .evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("div"));
        const el = nodes.find((n) => /^\d+ fps · /.test((n.textContent || "").trim()));
        return el ? el.textContent : "";
      })
      .catch(() => "");
    const m = (text || "").match(/(\d+) fps · (\d+) Draws · (\d+)k/);
    if (m) samples.push({ fps: +m[1], draws: +m[2], tri: +m[3] });
    await page.waitForTimeout(600);
  }
  if (samples.length) {
    const fps = samples.map((s) => s.fps).sort((a, b) => a - b);
    console.log(
      `\nMESSUNG Zuhause @1720x1250: fps Median ${fps[Math.floor(fps.length / 2)]} ` +
        `(${fps[0]}–${fps[fps.length - 1]}), ${samples[0].draws} Draws, ${samples[0].tri}k Dreiecke, ` +
        `${samples.length} Proben`,
    );
  } else {
    console.log("\nMESSUNG: keine Proben (Entwicklerwerte aus?)");
  }

  // A measurement that is only printed cannot fail, and a check that cannot
  // fail is a note. The floor is deliberately well below the 60 the scene
  // currently holds: this is here to catch a collapse, not to argue about
  // five frames on a machine that is also compiling something.
  const MIN_FPS = 40;
  if (samples.length) {
    const fps = samples.map((s) => s.fps).sort((a, b) => a - b);
    const median = fps[Math.floor(fps.length / 2)];
    AT("Bildrate über der Untergrenze", median >= MIN_FPS, `${median} fps, Grenze ${MIN_FPS}`);
  } else {
    AT("Bildrate über der Untergrenze", false, "keine Proben");
  }

  AT("Keine Laufzeitfehler", errors.length === 0, errors.slice(0, 2).join(" | ") || "keine");

  // --- The error boundary, proven rather than asserted ----------------------
  // A separate page: the crash is armed by a URL parameter, and arming it in
  // the page under test would contaminate every check above it.
  const crashPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const crashErrors = [];
  crashPage.on("pageerror", (e) => crashErrors.push(e.message.slice(0, 80)));
  await crashPage.goto("http://localhost:3400/v2?boom=home", { waitUntil: "domcontentloaded" });
  await crashPage.waitForTimeout(9000);

  const boundaryShown = await crashPage
    .locator("text=/Diese Welt ist abgestürzt/")
    .first()
    .isVisible()
    .catch(() => false);
  AT("Absturz wird aufgefangen", boundaryShown);

  // The whole point: the way out survives the failure.
  const dockAlive = await crashPage
    .getByRole("button", { name: /wissen/i })
    .first()
    .isVisible()
    .catch(() => false);
  AT("HUD überlebt den Absturz", dockAlive);

  if (dockAlive) {
    await crashPage.getByRole("button", { name: /wissen/i }).first().click();
    await crashPage.waitForTimeout(6000);
    const recovered = await crashPage.locator("canvas").first().isVisible().catch(() => false);
    const stillBroken = await crashPage
      .locator("text=/Diese Welt ist abgestürzt/")
      .first()
      .isVisible()
      .catch(() => false);
    AT("Andere Welt baut sich wieder auf", recovered && !stillBroken);
  }

  await crashPage.close();
  await browser.close();
})();
