const LOWERCASE_WORDS = new Set([
  "a",
  "al",
  "and",
  "con",
  "de",
  "del",
  "des",
  "el",
  "en",
  "for",
  "in",
  "la",
  "las",
  "los",
  "of",
  "on",
  "or",
  "para",
  "por",
  "que",
  "the",
  "to",
  "u",
  "un",
  "una",
  "y",
  "e",
  "x",
]);

const UPPERCASE_EXCEPTIONS = new Map([
  ["bts", "BTS"],
  ["dj", "DJ"],
  ["ebm", "EBM"],
  ["edm", "EDM"],
  ["gyt", "GYT"],
  ["k-pop", "K-Pop"],
  ["kpop", "K-Pop"],
  ["px", "PX"],
  ["r&b", "R&B"],
]);

function capitalizeWord(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase("es-PE") + value.slice(1);
}

function formatCoreWord(core: string, forceCapitalized: boolean): string {
  const lowered = core.toLocaleLowerCase("es-PE");
  const uppercaseException = UPPERCASE_EXCEPTIONS.get(lowered);
  if (uppercaseException) return uppercaseException;

  if (/^[ivxlcdm]+$/i.test(core) && core.length <= 5) {
    return core.toUpperCase();
  }

  if (!forceCapitalized && LOWERCASE_WORDS.has(lowered)) {
    return lowered;
  }

  return capitalizeWord(lowered);
}

function formatToken(token: string, forceCapitalized: boolean): string {
  const match = token.match(/^([^A-Za-zÁÉÍÓÚáéíóúÜüÑñ0-9]*)(.*?)([^A-Za-zÁÉÍÓÚáéíóúÜüÑñ0-9]*)$/);
  if (!match) return token;

  const [, leading, core, trailing] = match;
  if (!core) return token;

  const formattedCore = core
    .split(/([-\/])/)
    .map((part) => {
      if (part === "-" || part === "/") return part;
      return formatCoreWord(part, forceCapitalized);
    })
    .join("");

  return `${leading}${formattedCore}${trailing}`;
}

export function formatEventTitle(value: string | null | undefined): string {
  if (!value) return "";

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  const tokens = normalized.split(" ");

  return tokens
    .map((token, index) => {
      const previousToken = tokens[index - 1] ?? "";
      const forceCapitalized =
        index === 0 ||
        index === tokens.length - 1 ||
        /[:([{-]$/.test(previousToken);

      return formatToken(token, forceCapitalized);
    })
    .join(" ");
}
