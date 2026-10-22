import type { Locale } from "@/lib/case/schema";

/*
 * Last line of defence on a suspect's answer, checked while it streams.
 * The prompt never contains the solution or other suspects' secrets, so the
 * main risks left are the model stepping out of character, echoing its
 * instructions, or the killer confessing. Pure functions: shared by the API
 * and the injection eval.
 */

export type Violation = "breaks_character" | "echoes_prompt" | "killer_confession";

const BREAKS_CHARACTER: RegExp[] = [
  /\bas an? (ai|a\.i\.|artificial intelligence|language model|assistant|chatbot)\b/i,
  /\b(i am|i'm) (an? )?(ai|a\.i\.|bot|chatbot|computer program|language model|virtual assistant)\b/i,
  /\b(language model|large language|chatbot|chat ?gpt|openai|gemini|anthropic|llm)\b/i,
  /\b(system prompt|my (instructions|programming|prompt)|these instructions|i (was|am|have been) (programmed|instructed))\b/i,
  // Like the English ones: claiming to BE an AI, not merely saying the word. A 1930s
  // suspect puzzling over "yapay zekâ da neyin nesi?" is in character.
  /(ben (bir )?yapay zek[aâ]|yapay zek[aâ]y[ıi]m|(bir )?yapay zek[aâ] (olarak|modeli|asistan)|dil modeli|sohbet botu|sistem (istemi|komutu|mesajı)|talimatlarım|programlandım|asistanıyım)/i,
];

const ECHOES_PROMPT: RegExp[] = [
  /\b(HOW TO ANSWER|YOUR SECRETS|YOUR LIES|WHAT YOU KNOW|ABOUT THE MURDER|YOUR EVENING|THE SITUATION)\b/,
  /reveal only:/i,
  /\[reply in (english|turkish)\.?\]/i,
  /the detective says:/i,
];

// Only the bracketed tag: whitespace before it may already have been sent, and the
// saved answer is trimmed anyway.
const LANGUAGE_REMINDER = /\[reply in (english|turkish)\.?\]/gi;

/**
 * The language reminder we add after each question ("[Reply in Turkish.]")
 * sometimes comes back at the end of an answer. It's our own text, not a leak,
 * so it is quietly removed instead of blocking an otherwise good answer.
 */
export function stripLanguageReminder(text: string): string {
  return text.replace(LANGUAGE_REMINDER, "");
}

const KILLER_CONFESSION: RegExp[] = [
  /\bI (killed|murdered|struck down|bludgeoned) (him|edmund|sir edmund)\b/i,
  /\b(it was me who|I'm the one who|I am the one who) (killed|murdered)\b/i,
  /\bI did (it|kill him)\b/i,
  /(onu )?ben öldürdüm|öldüren (bendim|benim)|katil benim|ben vurdum/i,
];

export function findViolation(text: string, opts: { isKiller: boolean }): Violation | null {
  if (ECHOES_PROMPT.some((re) => re.test(text))) return "echoes_prompt";
  if (BREAKS_CHARACTER.some((re) => re.test(text))) return "breaks_character";
  if (opts.isKiller && KILLER_CONFESSION.some((re) => re.test(text))) return "killer_confession";
  return null;
}

/** What the player sees instead of a blocked answer: still in character. */
export const DEFLECTION: Record<Locale, string> = {
  en: "I'd rather not go down that road, detective. Ask me something sensible.",
  tr: "O konuya girmek istemiyorum dedektif. Bana makul bir şey sorun.",
};

/**
 * Characters held back while streaming, so a phrase split across chunks
 * ("as an" + " AI") is checked as a whole before any of it is sent.
 */
export const STREAM_HOLDBACK = 40;
