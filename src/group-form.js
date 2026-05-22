import { getGroups } from "./data.js";
import { isGroupComplete } from "./groups.js";

const POSITIONS = [
  { index: 0, label: "1st" },
  { index: 1, label: "2nd" },
  { index: 2, label: "3rd" },
  { index: 3, label: "4th" },
];

/** order[0]=1st place team id, etc. */
export function getOrderForGroup(userGroups, groupId, teams) {
  const order = userGroups?.[groupId];
  if (isGroupComplete(order)) return order;
  return [null, null, null, null];
}

export function getRankForTeam(order, teamId) {
  if (!order) return null;
  const idx = order.indexOf(teamId);
  return idx >= 0 ? idx : null;
}

export function applyRankSelection(order, teamId, positionIndex) {
  const next = [...(order ?? [null, null, null, null])];

  for (let i = 0; i < 4; i++) {
    if (next[i] === teamId) next[i] = null;
  }

  if (positionIndex !== null && positionIndex >= 0) {
    next[positionIndex] = teamId;
  }

  return next;
}

export function renderGroupTable(group, order, locked, escapeHtml) {
  const complete = isGroupComplete(order);
  const rows = group.teams
    .map((team) => {
      const currentRank = getRankForTeam(order, team.id);
      const host = team.host ? ' <span class="host-tag">H</span>' : "";

      const cells = POSITIONS.map(
        (pos) => `
        <td class="pick-cell">
          <label class="pick-radio">
            <input
              type="radio"
              name="rank-${group.id}-${team.id}"
              value="${pos.index}"
              data-group="${group.id}"
              data-team="${team.id}"
              ${currentRank === pos.index ? "checked" : ""}
              ${locked ? "disabled" : ""}
            />
            <span class="pick-radio__label">${pos.label}</span>
          </label>
        </td>`
      ).join("");

      return `
        <tr>
          <th scope="row" class="team-cell">${escapeHtml(team.name)}${host}</th>
          ${cells}
        </tr>`;
    })
    .join("");

  return `
    <section class="group-form" id="group-${group.id}" data-group="${group.id}">
      <div class="group-form__head">
        <h3 class="group-form__title">Group ${group.id}</h3>
        <span class="group-form__status ${complete ? "group-form__status--done" : ""}">
          ${complete ? "Complete" : "Pick all four places"}
        </span>
      </div>
      <div class="table-wrap">
        <table class="group-table">
          <thead>
            <tr>
              <th scope="col">Team</th>
              ${POSITIONS.map((p) => `<th scope="col">${p.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

export function buildPredictionFormHtml(userGroups, locked, escapeHtml) {
  return getGroups()
    .map((group) => {
      const order = getOrderForGroup(userGroups, group.id, group.teams);
      return renderGroupTable(group, order, locked, escapeHtml);
    })
    .join("");
}

export function bindPredictionForm(container, getUser, persistGroup, onProgress, isLocked) {
  container.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "radio" || !input.dataset.group) return;

    const user = getUser();
    if (!user || isLocked?.(user)) return;

    const groupId = input.dataset.group;
    const teamId = input.dataset.team;
    const positionIndex = Number(input.value);

    const current = getOrderForGroup(user.groups, groupId);
    const next = applyRankSelection(current, teamId, positionIndex);

    user.groups = { ...user.groups, [groupId]: next };
    persistGroup(groupId, next);

    const section = container.querySelector(`#group-${groupId}`);
    const status = section?.querySelector(".group-form__status");
    if (status) {
      const done = isGroupComplete(next);
      status.textContent = done ? "Complete" : "Pick all four places";
      status.classList.toggle("group-form__status--done", done);
    }

    onProgress?.();
  });
}

export function countFormProgress(userGroups) {
  const groups = getGroups();
  const done = groups.filter((g) => isGroupComplete(userGroups?.[g.id])).length;
  return { done, total: groups.length };
}
