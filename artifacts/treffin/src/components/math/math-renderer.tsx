import React, { useMemo } from "react";
import katex from "katex";

export function MathRenderer({ tex, display = false, className = "" }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: display });
    } catch (e) {
      return tex;
    }
  }, [tex, display]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MathText({ text, className = "" }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const result: React.ReactNode[] = [];
    const regex = /\$\$([\s\S]+?)\$\$|\$([\s\S]+?)\$/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }

      if (match[1]) {
        result.push(<MathRenderer key={`math-${match.index}`} tex={match[1]} display={true} className="block my-4" />);
      } else if (match[2]) {
        result.push(<MathRenderer key={`math-${match.index}`} tex={match[2]} display={false} />);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return result;
  }, [text]);

  return <span className={`text-gray-900 dark:text-gray-100 ${className}`}>{parts}</span>;
}
