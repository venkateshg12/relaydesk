// The agent's own choices, remembered per browser (the account page writes them, the inbox reads them).
// Storage can be blocked, so both directions are guarded and the defaults apply without it.
const SOUND_KEY = "rd_notification_sound";
const PRESENCE_KEY = "rd_presence_status";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the choice lasts until the page closes.
  }
};

export const preferences = {
  isSoundEnabled: () => read(SOUND_KEY) !== "false",
  setSoundEnabled: (enabled: boolean) => write(SOUND_KEY, String(enabled)),

  isAway: () => read(PRESENCE_KEY) === "away",
  setAway: (isAway: boolean) => write(PRESENCE_KEY, isAway ? "away" : "online"),
};
