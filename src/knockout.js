import { getMatchById, getTeam } from "./data.js";
import { getKnockoutRounds } from "./data.js";

/** Resolve a slot label to a team id using fixtures or user's group picks */
export function resolveSlotLabel(label, userGroups, fixtures) {
  const winner = /^Winner (.+)$/.exec(label);
  if (winner) {
    const groupId = winner[1].replace("Group ", "").trim();
    return userGroups[groupId]?.[0] ?? null;
  }

  const runnerUp = /^Runner-up (.+)$/.exec(label);
  if (runnerUp) {
    const groupId = runnerUp[1].replace("Group ", "").trim();
    return userGroups[groupId]?.[1] ?? null;
  }

  const winnerMatch = /^Winner (.+)$/.exec(label);
  if (winnerMatch && label.startsWith("Winner r")) {
    return null;
  }

  if (fixtures?.[label]) return fixtures[label];
  return null;
}

export function getMatchSides(matchId, userKnockout, userGroups, fixtures) {
  const fixture = fixtures?.[matchId];
  if (fixture?.home && fixture?.away) {
    return {
      home: getTeam(fixture.home),
      away: getTeam(fixture.away),
      resolved: true,
    };
  }

  const match = getMatchById(matchId);
  if (!match) return { home: null, away: null, resolved: false };

  const homeId = resolveSlotFromLabel(match.home, userKnockout, userGroups);
  const awayId = resolveSlotFromLabel(match.away, userKnockout, userGroups);

  return {
    home: homeId ? getTeam(homeId) : null,
    away: awayId ? getTeam(awayId) : null,
    homeLabel: match.home,
    awayLabel: match.away,
    resolved: !!(homeId && awayId),
  };
}

function resolveSlotFromLabel(label, userKnockout, userGroups) {
  const winnerGroup = /^Winner Group ([A-L])$/.exec(label);
  if (winnerGroup) return userGroups[winnerGroup[1]]?.[0] ?? null;

  const runnerGroup = /^Runner-up Group ([A-L])$/.exec(label);
  if (runnerGroup) return userGroups[runnerGroup[1]]?.[1] ?? null;

  const winnerPrev = /^Winner (r\d+-\d+|r16-\d+|qf-\d+|sf-\d+)$/.exec(label);
  if (winnerPrev) return userKnockout[winnerPrev[1]] ?? null;

  const loserPrev = /^Loser (sf-\d+)$/.exec(label);
  if (loserPrev) {
    const sfId = loserPrev[1];
    const sfWinner = userKnockout[sfId];
    if (!sfWinner) return null;
    const sides = getMatchSides(sfId, userKnockout, userGroups, {});
    const ids = [sides.home?.id, sides.away?.id].filter(Boolean);
    return ids.find((id) => id !== sfWinner) ?? null;
  }

  return null;
}

export function countKnockoutPicks(knockoutPicks, rounds = getKnockoutRounds()) {
  const total = rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const done = Object.keys(knockoutPicks || {}).length;
  return { done, total };
}
