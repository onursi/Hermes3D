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

  AT("Keine Laufzeitfehler", errors.length === 0, errors.slice(0, 2).join(" | ") || "keine");
  await browser.close();
})();
