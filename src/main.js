import { gameConfig } from "./config.js";
import { getGroups, getTeam, getKnockoutRounds } from "./data.js";
import { countCompletedGroups } from "./groups.js";
import {
  buildPredictionFormHtml,
  bindPredictionForm,
  countFormProgress,
} from "./group-form.js";
import { getMatchSides, countKnockoutPicks } from "./knockout.js";
import { buildLeaderboard } from "./scoring.js";
import {
  getCurrentUserName,
  setCurrentUserName,
  getUserEntry,
  saveUserEntry,
  listAllUsers,
  getAllUsers,
  getTournamentState,
  saveTournamentState,
  isGroupStageLocked,
  isKnockoutOpen,
  isKnockoutLocked,
  exportAllData,
  importAllData,
  hasSubmittedGroups,
  areGroupPicksLocked,
  submitGroupPicksOnce,
  initStore,
  isCloudBackend,
  getBackendLabel,
  refreshStore,
  getStoreError,
} from "./store.js";
import { syncFromGoogleSheet, syncFromCsvFile } from "./sheet-sync.js";

const app = document.getElementById("app");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getRoute() {
  const hash = location.hash.replace(/^#\/?/, "") || "home";
  const [path, param] = hash.split("/");
  return { path, param };
}

function navigate(path, param = "") {
  location.hash = param ? `#/${path}/${param}` : `#/${path}`;
}

function ensureUser() {
  const name = getCurrentUserName();
  if (!name) {
    navigate("home");
    return null;
  }
  return getUserEntry(name) || saveUserEntry(name, {});
}

function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function showSyncResult({ merged, entries, errors, warnings }) {
  const lines = [`Imported ${merged} player(s) from ${entries} row(s).`];
  if (warnings.length) lines.push(`Warnings:\n• ${warnings.slice(0, 5).join("\n• ")}`);
  if (errors.length) lines.push(`Notes:\n• ${errors.slice(0, 5).join("\n• ")}`);
  alert(lines.join("\n\n"));
}

function bindSheetSync(root) {
  root.querySelector("#btn-sync-sheet")?.addEventListener("click", async () => {
    const url = root.querySelector("#input-sheet-url")?.value?.trim();
    if (!url) {
      alert("Paste your Google Sheet CSV export URL first.");
      return;
    }
    const btn = root.querySelector("#btn-sync-sheet");
    btn.disabled = true;
    btn.textContent = "Syncing…";
    try {
      showSyncResult(await syncFromGoogleSheet(url));
      render();
    } catch (err) {
      alert(err.message ?? "Sync failed");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sync from Google Sheet";
    }
  });

  root.querySelector("#input-csv-upload")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showSyncResult(await syncFromCsvFile(file));
      render();
    } catch (err) {
      alert(err.message ?? "Import failed");
    }
    e.target.value = "";
  });
}

function shell(content, activeNav = "") {
  const name = getCurrentUserName();
  const knockoutAvailable = isKnockoutOpen();

  return `
    <header class="header">
      <div class="header__badge">Friends pool</div>
      <h1 class="header__title">${escapeHtml(gameConfig.title)}</h1>
      <p class="header__subtitle">${escapeHtml(gameConfig.subtitle)}</p>
      ${name ? `<p class="header__user">Playing as <strong>${escapeHtml(name)}</strong></p>` : ""}
    </header>
    <nav class="nav">
      ${
        name
          ? `<a href="#/predictions" class="nav__link ${activeNav === "predictions" ? "nav__link--active" : ""}">My picks</a>
             <a href="#/bracket" class="nav__link ${activeNav === "bracket" ? "nav__link--active" : ""} ${!knockoutAvailable ? "nav__link--disabled" : ""}">Knockout</a>`
          : `<a href="#/home" class="nav__link ${activeNav === "home" ? "nav__link--active" : ""}">Home</a>`
      }
      <a href="#/leaderboard" class="nav__link ${activeNav === "leaderboard" ? "nav__link--active" : ""}">Scores</a>
      <a href="#/admin" class="nav__link ${activeNav === "admin" ? "nav__link--active" : ""}">Admin</a>
      ${name ? `<a href="#/home" class="nav__link">Switch player</a>` : ""}
    </nav>
    <main class="main">${content}</main>
    <footer class="footer">
      <p>Storage: <strong>${escapeHtml(getBackendLabel())}</strong>${isCloudBackend() ? " — same picks on every phone." : " — use Export/Import to merge devices."}</p>
    </footer>
  `;
}

function renderHome() {
  const name = getCurrentUserName();
  const players = listAllUsers();

  app.innerHTML = shell(
    `
    <section class="panel">
      <h2 class="panel__heading">Enter your name</h2>
      <p class="panel__text">Pick a <strong>unique</strong> display name. Each name can submit picks <strong>once</strong> — no edits after that.</p>
      ${getStoreError() && !isCloudBackend() ? `<p class="name-hint">Cloud sync unavailable: ${escapeHtml(getStoreError())}. Using this device only.</p>` : ""}
      <form class="form" id="name-form">
        <label class="form__field">
          <span class="form__label">Display name</span>
          <input type="text" id="input-display-name" value="${escapeHtml(name)}" maxlength="32" required placeholder="e.g. Amit" autocomplete="off" />
        </label>
        <p class="name-hint muted" id="name-hint" hidden></p>
        <button type="submit" class="btn btn--primary" id="btn-name-continue">Continue</button>
      </form>
    </section>
    ${
      players.length
        ? `<section class="panel">
            <h2 class="panel__heading">Who has played</h2>
            <ul class="player-list">
              ${players
                .map(
                  (p) =>
                    `<li><span>${escapeHtml(p.displayName)}</span> <span class="muted">${p.groupsSubmittedAt ? "Submitted · locked" : `${p.groupProgress}/12 · draft`}</span></li>`
                )
                .join("")}
            </ul>
          </section>`
        : ""
    }
    <section class="panel">
      <h2 class="panel__heading">How to play</h2>
      <ol class="setup-steps">
        <li>Enter your name and open <strong>My picks</strong>.</li>
        <li>For each group, choose <strong>1st / 2nd / 3rd / 4th</strong> for every team in the table.</li>
        <li>Submit once — picks are <strong>locked</strong> for that name and appear on <strong>Scores</strong>.</li>
      </ol>
      ${name ? `<a href="#/predictions" class="btn btn--primary btn--block">Go to my picks</a>` : ""}
      <a href="#/leaderboard" class="btn btn--ghost btn--block" style="margin-top:0.5rem">View scoreboard</a>
    </section>
    <section class="panel">
      <h2 class="panel__heading">Backup (optional)</h2>
      <p class="panel__text">Export or import JSON to copy all friends' picks onto another computer.</p>
      <div class="btn-row">
        <button type="button" class="btn btn--ghost" id="btn-export">Export all data</button>
        <label class="btn btn--ghost btn--file">
          Import data
          <input type="file" id="input-import" accept="application/json" hidden />
        </label>
      </div>
    </section>
    `,
    ""
  );

  const nameInput = document.getElementById("input-display-name");
  const nameHint = document.getElementById("name-hint");

  function updateNameHint() {
    const value = nameInput.value.trim();
    if (!value) {
      nameHint.hidden = true;
      return;
    }
    if (hasSubmittedGroups(value)) {
      nameHint.hidden = false;
      nameHint.textContent =
        "This name already submitted — you can view picks only, not change them.";
    } else {
      nameHint.hidden = true;
    }
  }

  nameInput.addEventListener("input", updateNameHint);
  updateNameHint();

  document.getElementById("name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = nameInput.value.trim();
    if (!value) return;
    setCurrentUserName(value);
    if (!getUserEntry(value)) {
      saveUserEntry(value, { displayName: value });
    }
    navigate("predictions");
  });

  document.getElementById("btn-export")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wc2026-backup-${Date.now()}.json`;
    a.click();
  });

  document.getElementById("input-import")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(JSON.parse(text));
      alert("Import successful.");
      render();
    } catch {
      alert("Could not import file.");
    }
  });

}

function renderPredictionForm() {
  const user = ensureUser();
  if (!user) return;

  const submitted = !!user.groupsSubmittedAt;
  const locked = areGroupPicksLocked(user);
  const { done, total } = countFormProgress(user.groups || {});

  app.innerHTML = shell(
    `
    <form class="prediction-form" id="prediction-form">
      <section class="stats stats--sticky">
        <article class="stat-card">
          <span class="stat-card__label">Groups done</span>
          <span class="stat-card__value" id="progress-count">${done}/${total}</span>
        </article>
        <article class="stat-card">
          <span class="stat-card__label">Status</span>
          <span class="stat-card__value stat-card__value--small">${submitted ? "Locked" : isGroupStageLocked() ? "Closed" : "Draft"}</span>
        </article>
        <article class="stat-card">
          <span class="stat-card__label">Lock date</span>
          <span class="stat-card__value stat-card__value--small">${formatDate(gameConfig.groupLockAt)}</span>
        </article>
      </section>
      <p class="panel__text">
        ${
          submitted
            ? "Your picks are final for this display name and cannot be changed."
            : "For each team, select exactly one place: 1st, 2nd, 3rd, or 4th. You can only submit once."
        }
      </p>
      <div id="group-tables">
        ${buildPredictionFormHtml(user.groups || {}, locked, escapeHtml)}
      </div>
      <div class="submit-bar">
        ${
          !submitted && !locked
            ? `<button type="submit" class="btn btn--primary btn--block" id="btn-submit-groups" ${done < total ? "disabled" : ""}>
                Save & submit my picks (${done}/${total})
              </button>`
            : submitted
              ? `<p class="notice notice--success">Submitted and locked. This display name cannot pick again.</p>`
              : isGroupStageLocked()
                ? `<p class="notice">Group stage is closed — no new submissions.</p>`
                : ""
        }
      </div>
    </form>
    `,
    "predictions"
  );

  const form = document.getElementById("prediction-form");

  bindPredictionForm(
    form,
    () => user,
    (groupId, order) => {
      if (areGroupPicksLocked(user)) return;
      const updated = saveUserEntry(getCurrentUserName(), {
        groups: { ...user.groups, [groupId]: order },
      });
      user.groups = updated.groups;
    },
    () => {
      const { done: d, total: t } = countFormProgress(user.groups);
      const el = document.getElementById("progress-count");
      const btn = document.getElementById("btn-submit-groups");
      if (el) el.textContent = `${d}/${t}`;
      if (btn) btn.disabled = d < t;
      if (btn) btn.textContent = `Save & submit my picks (${d}/${t})`;
    },
    areGroupPicksLocked
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (user.groupsSubmittedAt) {
      alert("You already submitted for this display name. Picks cannot be changed.");
      return;
    }
    const { done: d, total: t } = countFormProgress(user.groups);
    if (d < t) {
      alert(`Complete all groups first (${d}/${t}).`);
      return;
    }
    const name = getCurrentUserName();
    const result = await submitGroupPicksOnce(name);
    if (!result.ok) {
      if (result.reason === "already_submitted") {
        alert("This display name already submitted picks. Use a different name on Home.");
      } else {
        alert(result.reason);
      }
      render();
      return;
    }
    user.groupsSubmittedAt = result.entry.groupsSubmittedAt;
    alert("Picks submitted and locked! Check the Scores tab.");
    render();
  });

  const hash = location.hash;
  const anchor = hash.match(/#group-([A-L])/i);
  if (anchor) {
    requestAnimationFrame(() => {
      document.getElementById(`group-${anchor[1].toUpperCase()}`)?.scrollIntoView({ behavior: "smooth" });
    });
  }
}

function renderBracket() {
  const user = ensureUser();
  if (!user) return;

  const state = getTournamentState();
  const open = isKnockoutOpen();
  const locked = isKnockoutLocked();
  const submitted = !!user.knockoutSubmittedAt;
  const { done, total } = countKnockoutPicks(user.knockout || {});
  const groupsDone = countCompletedGroups(user.groups || {}).done === 12;

  if (!open) {
    app.innerHTML = shell(
      `
      <section class="panel">
        <h2 class="panel__heading">Knockout bracket</h2>
        <p class="panel__text">Opens after the group stage (target: ${formatDate(gameConfig.knockoutOpensAt)}). You'll pick the winner of each match — Round of 32 through the Final.</p>
        <div class="notice">Finish and submit your group rankings first.${groupsDone ? " Groups look complete." : ""}</div>
      </section>
      `,
      "bracket"
    );
    return;
  }

  const rounds = getKnockoutRounds();
  const picks = { ...(user.knockout || {}) };

  app.innerHTML = shell(
    `
    <section class="stats">
      <article class="stat-card">
        <span class="stat-card__label">Bracket picks</span>
        <span class="stat-card__value">${done}/${total}</span>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Status</span>
        <span class="stat-card__value stat-card__value--small">${submitted ? "Submitted" : locked ? "Locked" : "Open"}</span>
      </article>
    </section>
    <section class="panel">
      <p class="panel__text">Choose a winner for each match. Later rounds use your earlier picks. Third-place slots from the real draw can be set in Admin.</p>
      ${rounds
        .map((round) => {
          const matchesHtml = round.matches
            .map((match) => {
              const sides = getMatchSides(match.id, picks, user.groups, state.knockoutFixtures);
              const homeName = sides.home?.name ?? sides.homeLabel ?? "?";
              const awayName = sides.away?.name ?? sides.awayLabel ?? "?";
              const pick = picks[match.id];
              const canPick = sides.resolved || sides.home || sides.away;

              return `
                <div class="match-card" data-match="${match.id}">
                  <div class="match-card__teams">
                    <button type="button" class="match-pick ${pick === sides.home?.id ? "match-pick--selected" : ""}" data-match="${match.id}" data-team="${sides.home?.id ?? ""}" ${!sides.home?.id || locked ? "disabled" : ""}>
                      ${escapeHtml(homeName)}
                    </button>
                    <span class="match-card__vs">vs</span>
                    <button type="button" class="match-pick ${pick === sides.away?.id ? "match-pick--selected" : ""}" data-match="${match.id}" data-team="${sides.away?.id ?? ""}" ${!sides.away?.id || locked ? "disabled" : ""}>
                      ${escapeHtml(awayName)}
                    </button>
                  </div>
                  ${!canPick ? `<p class="match-card__hint muted">Complete earlier rounds or set fixtures in Admin</p>` : ""}
                </div>`;
            })
            .join("");
          return `<div class="round-block"><h3 class="round-block__title">${escapeHtml(round.name)}</h3>${matchesHtml}</div>`;
        })
        .join("")}
      ${
        !submitted && !locked
          ? `<button type="button" class="btn btn--primary btn--block" id="btn-submit-knockout">Submit bracket</button>`
          : submitted
            ? `<p class="notice notice--success">Knockout bracket submitted.</p>`
            : ""
      }
    </section>
    `,
    "bracket"
  );

  app.querySelectorAll(".match-pick:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const matchId = btn.dataset.match;
      const teamId = btn.dataset.team;
      if (!teamId) return;
      picks[matchId] = teamId;
      saveUserEntry(getCurrentUserName(), { knockout: picks });
      user.knockout = picks;
      renderBracket();
    });
  });

  document.getElementById("btn-submit-knockout")?.addEventListener("click", () => {
    if (Object.keys(picks).length < total) {
      if (!confirm(`Only ${Object.keys(picks).length}/${total} matches picked. Submit anyway?`)) return;
    }
    saveUserEntry(getCurrentUserName(), { knockoutSubmittedAt: Date.now() });
    render();
  });
}

function renderLeaderboard() {
  const state = getTournamentState();
  const rows = buildLeaderboard(getAllUsers(), state);
  const hasResults = Object.keys(state.groupResults || {}).length > 0;
  const playerCount = Object.keys(getAllUsers()).length;

  app.innerHTML = shell(
    `
    <section class="panel">
      <h2 class="panel__heading">Leaderboard</h2>
      <p class="panel__text">${playerCount} player(s) in the pool · ${escapeHtml(getBackendLabel())}</p>
      ${
        isCloudBackend()
          ? `<div class="btn-row"><button type="button" class="btn btn--ghost" id="btn-refresh-scores">Refresh from server</button></div>`
          : ""
      }
      ${
        !hasResults
          ? `<p class="panel__text">Everyone appears below once they submit. Enter real group results in <a href="#/admin">Admin</a> to calculate points.</p>`
          : ""
      }
      <div class="table-wrap">
        <table class="leaderboard">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Submitted</th>
              <th>Groups</th>
              <th>Knockout</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${escapeHtml(r.displayName)}</td>
                  <td>${r.groupsDone ? "Yes" : "—"}</td>
                  <td>${hasResults ? r.groupPoints : "—"}</td>
                  <td>${hasResults ? r.knockoutPoints : "—"}</td>
                  <td><strong>${hasResults ? r.totalPoints : "—"}</strong></td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6" class="muted">No players yet — <a href="#/home">enter your name</a> and submit picks</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <ul class="legend">
        <li>Group: ${gameConfig.scoring.exactPosition} pts exact position, ${gameConfig.scoring.wrongPosition} pt if team placed wrong</li>
        <li>Knockout: ${gameConfig.scoring.knockoutMatch} pts per correct match winner</li>
      </ul>
    </section>
    `,
    "leaderboard"
  );

  document.getElementById("btn-refresh-scores")?.addEventListener("click", async () => {
    await refreshStore();
    render();
  });
}

function renderAdmin() {
  const state = getTournamentState();
  const sheetUrl = state.googleSheetCsvUrl || gameConfig.googleSheetCsvUrl || "";

  app.innerHTML = shell(
    `
    <section class="panel">
      <h2 class="panel__heading">Admin (friends pool)</h2>
      <p class="panel__text">For the organizer. Controls are stored in this browser.</p>
      <label class="form__field">
        <span class="form__label">Tournament phase</span>
        <select id="admin-phase">
          <option value="groups_open" ${state.phase === "groups_open" ? "selected" : ""}>Groups open</option>
          <option value="groups_locked" ${state.phase === "groups_locked" ? "selected" : ""}>Groups locked</option>
          <option value="knockout_open" ${state.phase === "knockout_open" ? "selected" : ""}>Knockout open</option>
          <option value="knockout_locked" ${state.phase === "knockout_locked" ? "selected" : ""}>Knockout locked</option>
          <option value="scored" ${state.phase === "scored" ? "selected" : ""}>Scored / final</option>
        </select>
      </label>
      <button type="button" class="btn btn--primary btn--block" id="btn-save-phase">Save phase</button>
    </section>
    <section class="panel">
      <h2 class="panel__heading">Google Form sync</h2>
      <p class="panel__text">Pull latest picks from the linked spreadsheet (same as <a href="${gameConfig.googleFormUrl}" target="_blank" rel="noopener">FIFA World Coup Group Stages</a> form).</p>
      <label class="form__field">
        <span class="form__label">Sheet URL</span>
        <input type="url" id="input-sheet-url" value="${escapeHtml(sheetUrl)}" />
      </label>
      <button type="button" class="btn btn--primary btn--block" id="btn-sync-sheet">Sync now</button>
      <label class="btn btn--ghost btn--file btn--block" style="margin-top:0.5rem;text-align:center">
        Upload CSV from Sheets
        <input type="file" id="input-csv-upload" accept=".csv,text/csv" hidden />
      </label>
    </section>
    <section class="panel">
      <h2 class="panel__heading">Actual group results (JSON)</h2>
      <p class="panel__text">Object keyed by group id A–L, each value an array of 4 team ids (1st to 4th). Example: <code>{"A":["MEX","RSA","KOR","CZE"]}</code></p>
      <textarea class="textarea" id="admin-group-results" rows="8">${escapeHtml(JSON.stringify(state.groupResults || {}, null, 2))}</textarea>
      <button type="button" class="btn btn--ghost btn--block" id="btn-save-group-results">Save group results</button>
    </section>
    <section class="panel">
      <h2 class="panel__heading">Knockout match winners (JSON)</h2>
      <p class="panel__text">Map match id to winning team id. Example: <code>{"r32-1":"MEX","r16-1":"MEX"}</code></p>
      <textarea class="textarea" id="admin-knockout-results" rows="8">${escapeHtml(JSON.stringify(state.knockoutResults || {}, null, 2))}</textarea>
      <button type="button" class="btn btn--ghost btn--block" id="btn-save-knockout-results">Save knockout results</button>
    </section>
    `,
    ""
  );

  document.getElementById("btn-save-phase").addEventListener("click", () => {
    state.phase = document.getElementById("admin-phase").value;
    saveTournamentState(state);
    alert("Phase saved.");
    render();
  });

  document.getElementById("btn-save-group-results").addEventListener("click", () => {
    try {
      state.groupResults = JSON.parse(document.getElementById("admin-group-results").value);
      saveTournamentState(state);
      alert("Group results saved.");
    } catch {
      alert("Invalid JSON.");
    }
  });

  document.getElementById("btn-save-knockout-results").addEventListener("click", () => {
    try {
      state.knockoutResults = JSON.parse(document.getElementById("admin-knockout-results").value);
      saveTournamentState(state);
      alert("Knockout results saved.");
    } catch {
      alert("Invalid JSON.");
    }
  });

  bindSheetSync(app);
}

function render() {
  const { path, param } = getRoute();

  switch (path) {
    case "home":
      renderHome();
      break;
    case "groups":
    case "predictions":
      renderPredictionForm();
      break;
    case "group":
      navigate("predictions");
      location.hash = `#/predictions#group-${param?.toUpperCase()}`;
      break;
    case "bracket":
      renderBracket();
      break;
    case "leaderboard":
      renderLeaderboard();
      break;
    case "admin":
      renderAdmin();
      break;
    default:
      if (getCurrentUserName()) navigate("predictions");
      else navigate("home");
  }
}

window.addEventListener("hashchange", () => {
  if (storeReady) render();
});

let storeReady = false;

function renderLoading(message = "Connecting to database…") {
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <h1 class="header__title">${escapeHtml(gameConfig.title)}</h1>
        <p class="header__subtitle">${escapeHtml(message)}</p>
      </header>
    </div>`;
}

async function boot() {
  if (import.meta.env.VITE_SUPABASE_URL) {
    renderLoading();
  }

  await initStore();
  storeReady = true;

  if (getStoreError() && !isCloudBackend()) {
    console.warn("Supabase config present but using local storage:", getStoreError());
  }

  if (getCurrentUserName() && (location.hash === "" || location.hash === "#")) {
    navigate("predictions");
  } else {
    render();
  }
}

boot();
