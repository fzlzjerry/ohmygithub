import type {
  ConversationActor,
  ConversationBadge,
  ConversationReaction,
  ConversationTimelineEvent,
  ConversationTimelineItem as SharedConversationTimelineItem,
} from '@/components'

export type PullRequestActorSummary = GitHubActor
export type PullRequestReactionSummary = GitHubIssueReaction
export type PullRequestMilestoneSummary = GitHubIssueMilestone
export type PullRequestComment = GitHubPullRequestComment
export type PullRequestReviewRequest = GitHubPullRequestReviewRequest
export type PullRequestReviewSummary = GitHubPullRequestReviewSummary
export type PullRequestReviewCommentSummary = GitHubPullRequestReviewComment
export type PullRequestLinkedIssue = GitHubPullRequestLinkedIssue
export type PullRequestCommitSummary = GitHubPullRequestCommitSummary
export type PullRequestTimelineReference = GitHubPullRequestTimelineReference
export type PullRequestTimelineEvent = GitHubPullRequestTimelineEvent
export type PullRequestDetail = GitHubPullRequestDetail

export type PullRequestTimelineItem =
  | SharedConversationTimelineItem & {
      id: string
      kind: 'comment'
      commentId: string
      nodeId: string
      actor: ConversationActor
      body: string
      createdAt?: string | null
      updatedAt?: string | null
      badges: ConversationBadge[]
      reactions: ConversationReaction[]
      viewerCanUpdate?: boolean
    }
  | SharedConversationTimelineItem & {
      id: string
      kind: 'commit-group'
      actor: ConversationActor
      createdAt?: string | null
      commits: PullRequestCommitSummary[]
    }
  | SharedConversationTimelineItem & {
      id: string
      kind: 'review'
      actor: ConversationActor
      body: string
      createdAt?: string | null
      reviewState: GitHubPullRequestReviewState
      comments: PullRequestReviewCommentSummary[]
      url?: string | null
    }
  | SharedConversationTimelineItem & {
      id: string
      kind: 'event'
      event: ConversationTimelineEvent
    }
