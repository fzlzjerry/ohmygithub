export async function setReaction(
  subjectId: string,
  content: GitHubReactionContent,
  reacted: boolean,
): Promise<void> {
  if (!window.ohMyGithub?.issues) {
    throw new Error('GitHub issues bridge is unavailable')
  }

  return window.ohMyGithub.issues.setReaction(subjectId, content, reacted)
}
