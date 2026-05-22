import groupsData from "../data/groups.json";

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['']/g, "'");
}

const byName = new Map();
const validIds = new Set();

for (const group of groupsData.groups) {
  for (const team of group.teams) {
    validIds.add(team.id);
    byName.set(normalize(team.name), team.id);
  }
}

/** API / FIFA naming → internal team id */
const ALIASES = {
  "korea republic": "KOR",
  "south korea": "KOR",
  czechia: "CZE",
  "czech republic": "CZE",
  turkiye: "TUR",
  turkey: "TUR",
  "cote divoire": "CIV",
  "côte d'ivoire": "CIV",
  "ivory coast": "CIV",
  "ir iran": "IRN",
  iran: "IRN",
  "cabo verde": "CPV",
  "cape verde": "CPV",
  "congo dr": "COD",
  "dr congo": "COD",
  "democratic republic of the congo": "COD",
  usa: "USA",
  "united states": "USA",
  "united states of america": "USA",
  england: "ENG",
  "bosnia-herzegovina": "BIH",
  "bosnia and herzegovina": "BIH",
  irak: "IRQ",
  iraq: "IRQ",
  "saudi arabia": "KSA",
  "south africa": "RSA",
};

export function apiTeamToOurId(team) {
  if (!team) return null;

  const code = team.code?.trim().toUpperCase();
  if (code && validIds.has(code)) return code;

  const name = normalize(team.name);
  if (byName.has(name)) return byName.get(name);
  if (ALIASES[name]) return ALIASES[name];

  return null;
}
