import { getGroups } from "./data.js";
import { isGroupComplete } from "./groups.js";

const POSITIONS = [
  { index: 0, label: "1st" },
  { index: 1, label: "2nd" },
  { index: 2, label: "3rd" },
  { index: 3, label: "4th" },
];

/** order[0]=1st place team id, etc. */
export function getOrderForGroup(userGroups, groupId) {
  const order = userGroups?.[groupId];
  if (!order || order.length !== 4) return [null, null, null, null];
  return [...order];
}

export function getRankForTeam(order, teamId) {
  if (!order) return null;
  const idx = order.indexOf(teamId);
  return idx >= 0 ? idx : null;
}

/** Assign team to a position; that position and team are unique within the group */
export function applyRankSelection(order, teamId, positionIndex) {
  const next = order?.length === 4 ? [...order] : [null, null, null, null];

  for (let i = 0; i < 4; i++) {
    if (next[i] === teamId) next[i] = null;
  }

  if (positionIndex >= 0 && positionIndex < 4) {
    next[positionIndex] = teamId;
  }

  return next;
}

export function orderFromPositionRadios(container, groupId) {
  const order = [null, null, null, null];
  for (const pos of POSITIONS) {
    const checked = container.querySelector(
      `input[name="rank-${groupId}-${pos.index}"]:checked`
    );
    if (checked) order[pos.index] = checked.value;
  }
  return order;
}

export function renderGroupTable(group, order, locked, escapeHtml) {
  const complete = isGroupComplete(order);
  const rows = group.teams
    .map((team) => {
      const currentRank = getRankForTeam(order, team.id);
      const host = team.host ? ' <span class="host-tag">H</span>' : "";

      const cells = POSITIONS.map((pos) => {
        const takenByOther =
          order[pos.index] && order[pos.index] !== team.id;
        return `
        <td class="pick-cell ${takenByOther ? "pick-cell--muted" : ""}">
          <label class="pick-radio">
            <input
              type="radio"
              name="rank-${group.id}-${pos.index}"
              value="${team.id}"
              data-group="${group.id}"
              data-position="${pos.index}"
              ${currentRank === pos.index ? "checked" : ""}
              ${locked ? "disabled" : ""}
              aria-label="${team.name} ${pos.label}"
            />
            <span class="pick-radio__label">${pos.label}</span>
          </label>
        </td>`;
      }).join("");

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
      const order = getOrderForGroup(userGroups, group.id);
      return renderGroupTable(group, order, locked, escapeHtml);
    })
    .join("");
}

export function refreshGroupSection(
  container,
  groupId,
  order,
  locked,
  escapeHtml
) {
  const group = getGroups().find((g) => g.id === groupId);
  const section = container.querySelector(`#group-${groupId}`);
  if (!group || !section) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderGroupTable(group, order, locked, escapeHtml);
  section.replaceWith(wrapper.firstElementChild);
}

export function bindPredictionForm(
  container,
  getUser,
  persistGroup,
  onProgress,
  isLocked,
  escapeHtml
) {
  container.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "radio" || !input.dataset.group) return;

    const user = getUser();
    if (!user || isLocked?.(user)) return;

    const groupId = input.dataset.group;
    const next = orderFromPositionRadios(container, groupId);

    user.groups = { ...user.groups, [groupId]: next };
    persistGroup(groupId, next);

    const locked = isLocked(user);
    refreshGroupSection(container, groupId, next, locked, escapeHtml);

    onProgress?.();
  });
}

export function countFormProgress(userGroups) {
  const groups = getGroups();
  const done = groups.filter((g) => isGroupComplete(userGroups?.[g.id])).length;
  return { done, total: groups.length };
}
