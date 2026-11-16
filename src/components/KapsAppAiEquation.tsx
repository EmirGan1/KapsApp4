import katex from "katex";
import "katex/dist/katex.min.css";

function renderExpression(expression: string, displayMode: boolean): string {
  const options = {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore" as const,
    maxExpand: 400,
    maxSize: 20,
  };
  const html = katex.renderToString(expression, options);
  if (!html.includes("katex-error")) return html;

  // During live token streaming, repair trailing incomplete macros or unclosed braces
  let repaired = expression.replace(/\\[a-zA-Z]*$/, "").trim();
  const openBraces = (repaired.match(/(?<!\\)\{/g)?.length ?? 0) - (repaired.match(/(?<!\\)\}/g)?.length ?? 0);
  if (openBraces > 0 && openBraces <= 8) {
    repaired += "}".repeat(openBraces);
  }
  if (repaired) {
    const fallback = katex.renderToString(repaired, options);
    if (!fallback.includes("katex-error")) return fallback;
  }
  return html;
}

export default function KapsAppAiEquation({ expression, displayMode = false }: { expression: string; displayMode?: boolean }) {
  const html = renderExpression(expression, displayMode);
  return displayMode
    ? <div className="my-2 max-w-full overflow-x-auto overflow-y-hidden py-1" dangerouslySetInnerHTML={{ __html: html }} />
    : <span className="inline-block max-w-full overflow-x-auto align-middle" dangerouslySetInnerHTML={{ __html: html }} />;
}
