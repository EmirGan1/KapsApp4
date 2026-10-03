import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses and renders inline ($...$) and block ($$...$$) LaTeX equations using KaTeX.
 * Gracefully falls back to plain text if syntax is irregular.
 */
export default function MathRenderer({ content, className = "" }: MathRendererProps) {
  if (!content) return null;

  // Split by $$...$$ for block math, then by $...$ for inline math
  const renderFormattedText = (raw: string) => {
    // Check for block math $$...$$
    const blockParts = raw.split(/\$\$([\s\S]*?)\$\$/g);
    
    return blockParts.map((bPart, bIdx) => {
      // Odd indices are block math
      if (bIdx % 2 === 1) {
        try {
          const html = katex.renderToString(bPart.trim(), {
            displayMode: true,
            throwOnError: false
          });
          return (
            <div
              key={`block-${bIdx}`}
              className="my-3 overflow-x-auto text-center py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <div key={`block-${bIdx}`} className="my-2 font-mono text-center text-sm">
              {bPart}
            </div>
          );
        }
      }

      // Even indices: split by inline math $...$
      const inlineParts = bPart.split(/\$([^$]+)\$/g);
      return (
        <span key={`text-block-${bIdx}`}>
          {inlineParts.map((iPart, iIdx) => {
            if (iIdx % 2 === 1) {
              // Inline math
              try {
                const html = katex.renderToString(iPart.trim(), {
                  displayMode: false,
                  throwOnError: false
                });
                return (
                  <span
                    key={`inline-${iIdx}`}
                    className="inline-block mx-0.5"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              } catch {
                return (
                  <span key={`inline-${iIdx}`} className="font-mono mx-0.5">
                    {iPart}
                  </span>
                );
              }
            }

            // Normal text: handle linebreaks and bullet points
            return (
              <span key={`raw-${iIdx}`}>
                {iPart.split("\n").map((line, lIdx, arr) => (
                  <React.Fragment key={`l-${lIdx}`}>
                    {line}
                    {lIdx < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return <div className={`leading-relaxed ${className}`}>{renderFormattedText(content)}</div>;
}
