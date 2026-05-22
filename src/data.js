import groupsData from "../data/groups.json";
import knockoutData from "../data/knockout.json";

const teamById = new Map();

for (const group of groupsData.groups) {
  for (const team of group.teams) {
    teamById.set(team.id, { ...team, groupId: group.id });
  }
}

export function getGroups() {
  return groupsData.groups;
}

export function getTeam(id) {
  return teamById.get(id);
}

export function getAllTeams() {
  return [...teamById.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getKnockoutRounds() {
  return knockoutData.rounds;
}

export function getAllKnockoutMatches() {
  return knockoutData.rounds.flatMap((round) =>
    round.matches.map((match) => ({ ...match, roundId: round.id, roundName: round.name }))
  );
}

export function getMatchById(matchId) {
  return getAllKnockoutMatches().find((m) => m.id === matchId);
}

export function getGroupIds() {
  return groupsData.groups.map((g) => g.id);
}
