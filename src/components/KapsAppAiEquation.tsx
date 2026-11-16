import katex from "katex";
import "katex/dist/katex.min.css";

export default function KapsAppAiEquation({ expression, displayMode = false }: { expression: string; displayMode?: boolean }) {
  const html = katex.renderToString(expression, {
    displayMode, throwOnError: false, trust: false, maxExpand: 200, maxSize: 20,
  });
  return displayMode
    ? <div dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
}
