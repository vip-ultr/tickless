import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  apiKey?: string;
};

export const API_URL = extra.apiUrl ?? "https://tickless.onrender.com";
export const API_KEY = extra.apiKey ?? "";

export function authHeaders(): Record<string, string> {
  return API_KEY ? { "X-Tickless-Key": API_KEY } : {};
}
