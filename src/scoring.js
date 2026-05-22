import { gameConfig } from "./config.js";

const GROUP_IDS = "ABCDEFGHIJKL".split("");

export function scoreGroupPredictions(userGroups, actualResults) {
  let points = 0;
  let exactHits = 0;

  for (const groupId of GROUP_IDS) {
    const predicted = userGroups[groupId];
    const actual = actualResults[groupId];
    if (!predicted?.length || !actual?.length) continue;

    predicted.forEach((teamId, index) => {
      if (actual[index] === teamId) {
        points += gameConfig.scoring.exactPosition;
        exactHits += 1;
      } else if (actual.includes(teamId)) {
        points += gameConfig.scoring.wrongPosition;
      }
    });
  }

  return { points, exactHits };
}

export function scoreKnockoutPredictions(userKnockout, actualKnockout) {
  let points = 0;
  let correctMatches = 0;

  for (const [matchId, winnerId] of Object.entries(userKnockout || {})) {
    if (actualKnockout[matchId] && actualKnockout[matchId] === winnerId) {
      points += gameConfig.scoring.knockoutMatch;
      correctMatches += 1;
    }
  }

  return { points, correctMatches };
}

export function buildLeaderboard(users, tournamentState) {
  const { groupResults, knockoutResults } = tournamentState;
  const hasGroupResults = Object.keys(groupResults || {}).length === 12;

  return Object.values(users)
    .map((user) => {
      const groupScore = hasGroupResults
        ? scoreGroupPredictions(user.groups, groupResults)
        : { points: 0, exactHits: 0 };

      const knockoutScore =
        Object.keys(knockoutResults || {}).length > 0
          ? scoreKnockoutPredictions(user.knockout, knockoutResults)
          : { points: 0, correctMatches: 0 };

      return {
        displayName: user.displayName,
        groupPoints: groupScore.points,
        knockoutPoints: knockoutScore.points,
        totalPoints: groupScore.points + knockoutScore.points,
        exactHits: groupScore.exactHits,
        knockoutCorrect: knockoutScore.correctMatches,
        groupsDone: !!user.groupsSubmittedAt,
        knockoutDone: !!user.knockoutSubmittedAt,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || b.exactHits - a.exactHits);
}
