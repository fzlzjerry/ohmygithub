export const REACTION_CONTENTS = [
  'thumbs-up',
  'thumbs-down',
  'laugh',
  'hooray',
  'confused',
  'heart',
  'rocket',
  'eyes',
] as const

export type ReactionContent = typeof REACTION_CONTENTS[number]

const REACTION_EMOJI: Record<ReactionContent, string> = {
  'thumbs-up': '👍',
  'thumbs-down': '👎',
  'laugh': '😄',
  'hooray': '🎉',
  'confused': '😕',
  'heart': '❤️',
  'rocket': '🚀',
  'eyes': '👀',
}

export function isReactionContent(content: string): content is ReactionContent {
  return (REACTION_CONTENTS as readonly string[]).includes(content)
}

export function reactionEmoji(content: string): string {
  return isReactionContent(content) ? REACTION_EMOJI[content] : content
}
