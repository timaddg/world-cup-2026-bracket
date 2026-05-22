export const gameConfig = {
  title: "World Cup 2026 Predictions",
  subtitle: "Pick your group standings in the form below — saved in the app for the friends leaderboard.",
  /** Google Form (responses live in linked Sheet) */
  googleFormUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLScdfZB88y77hus-MXYWWRSh2QPf9g8iRoOtDzVxnoL-5DWBiA/viewform",
  /**
   * Paste your linked spreadsheet CSV export URL here after setup.
   * Example: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
   */
  googleSheetCsvUrl: "",
  groupLockAt: "2026-06-11T00:00:00-04:00",
  knockoutOpensAt: "2026-06-28T00:00:00-04:00",
  storageKeys: {
    users: "wc2026-users",
    state: "wc2026-tournament-state",
    currentUser: "wc2026-current-user",
  },
  scoring: {
    exactPosition: 3,
    wrongPosition: 1,
    knockoutMatch: 2,
  },
};
