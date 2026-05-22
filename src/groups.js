import { getGroupIds } from "./data.js";

export function isGroupComplete(order) {
  return Array.isArray(order) && order.length === 4 && new Set(order).size === 4;
}

export function countCompletedGroups(groups) {
  const ids = getGroupIds();
  const done = ids.filter((id) => isGroupComplete(groups[id])).length;
  return { done, total: ids.length };
}

export function moveTeam(order, index, direction) {
  const next = [...order];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function defaultGroupOrder(teams) {
  return teams.map((t) => t.id);
}
