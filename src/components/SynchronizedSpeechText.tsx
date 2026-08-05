import React from 'react';

interface SynchronizedSpeechTextProps {
  fullText: string;
  revealedText?: string;
  revealedChars?: number;
  wordIndex?: number;
  isSpeaking?: boolean;
  isStreaming?: boolean;
  isComplete?: boolean;
  className?: string;
  highlightWord?: boolean;
}

export const SynchronizedSpeechText: React.FC<SynchronizedSpeechTextProps> = ({
  fullText,
  revealedText,
  revealedChars,
  wordIndex = 0,
  isSpeaking = false,
  isStreaming = false,
  isComplete = false,
  className = '',
  highlightWord = true,
}) => {
  // If the message is completely finished and not actively speaking, render normal text
  if (isComplete || (!isStreaming && !isSpeaking)) {
    return <span className={className}>{fullText}</span>;
  }

  // Determine how much text has been revealed so far
  const currentRevealed = revealedText !== undefined
    ? revealedText
    : revealedChars !== undefined
    ? fullText.slice(0, revealedChars)
    : fullText;

  // Split revealed portion into words to provide synchronized karaoke highlighting on the currently spoken word
  const revealedWords = currentRevealed.split(/(\s+)/); // keeps whitespace tokens
  let wordCount = 0;

  return (
    <span className={`${className} inline`}>
      {revealedWords.map((token, idx) => {
        const isWhitespace = /^\s+$/.test(token);
        if (isWhitespace) {
          return <span key={idx}>{token}</span>;
        }

        const currentIdx = wordCount;
        wordCount++;
        const isCurrentActiveWord = isSpeaking && currentIdx === wordIndex;

        if (isCurrentActiveWord && highlightWord) {
          return (
            <span
              key={idx}
              className="inline-block bg-emerald-200/90 text-emerald-950 font-bold px-1 py-0.5 rounded-sm shadow-xs ring-1 ring-emerald-500/40 transition-all duration-100 animate-pulse"
            >
              {token}
            </span>
          );
        }

        return <span key={idx}>{token}</span>;
      })}

      {/* Synchronized blinking typewriter cursor while speaking or streaming */}
      {(isSpeaking || isStreaming) && !isComplete && (
        <span className="inline-flex items-center ml-0.5 align-middle">
          <span className="inline-block w-1.5 h-4 bg-emerald-500 rounded-xs animate-pulse opacity-90 shadow-sm shadow-emerald-500/50" />
        </span>
      )}
    </span>
  );
};
