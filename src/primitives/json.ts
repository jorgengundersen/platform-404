import { Option } from "effect";

export const safeParseJson = (raw: string): Option.Option<unknown> => {
  try {
    return Option.some(JSON.parse(raw));
  } catch {
    return Option.none();
  }
};
