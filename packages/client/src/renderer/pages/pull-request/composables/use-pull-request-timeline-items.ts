import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type {
  PullRequestActorSummary,
  PullRequestCommitSummary,
  PullRequestDetail,
  PullRequestReactionSummary,
  PullRequestTimelineEvent,
  PullRequestTimelineItem,
  PullRequestTimelineReference,
} from '@/pages/pull-request/components/types'
import type {
  ConversationActor,
  ConversationReaction,
  ConversationReference,
  ConversationTimelineEvent,
} from '@/components'
import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CheckCircle2,
  CircleDot,
  Copy,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  GitPullRequestDraft,
  Link2,
  Lock,
  LockOpen,
  MessageSquare,
  MessagesSquare,
  Pencil,
  Pin,
  PinOff,
  Rocket,
  RotateCcw,
  ShieldCheck,
  SquareKanban,
  Tag,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-vue-next'
import { hasRenderableText } from '@/components/conversation/format'
import { parseGitHubReferenceUrl } from '@/components/github/github-reference'

export function usePullRequestTimelineItems(
  pullRequest: MaybeRefOrGetter<PullRequestDetail | null | undefined>,
): ComputedRef<PullRequestTimelineItem[]> {
  const { t } = useI18n()

  return computed(() => {
    const currentPullRequest = toValue(pullRequest)
    if (!currentPullRequest) return []

    const comments = (currentPullRequest.comments ?? []).map<PullRequestTimelineItem>((comment) => ({
      id: `comment-${comment.id}`,
      kind: 'comment',
      commentId: String(comment.id),
      nodeId: comment.nodeId ?? '',
      actor: toConversationActor(comment.author) ?? { login: t('pullRequest.values.unknown') },
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      badges: [],
      reactions: toConversationReactions(comment.reactions),
      viewerCanUpdate: Boolean(comment.viewerCanUpdate),
    }))

    const events = (currentPullRequest.timelineEvents ?? []).flatMap<UngroupedPullRequestTimelineItem>((event) => {
      if (event.type === 'committed' && event.commit) {
        return [{
          id: `commit-${event.commit.id}`,
          kind: 'commit',
          actor: toConversationActor(event.commit.author) ?? { login: t('pullRequest.values.unknown') },
          createdAt: event.commit.committedDate,
          commit: event.commit,
        }]
      }

      if (event.type === 'reviewed' && (hasRenderableText(event.body) || (event.reviewComments ?? []).length > 0)) {
        return [{
          id: `review-${event.id}`,
          kind: 'review',
          actor: toConversationActor(event.actor) ?? { login: t('pullRequest.values.unknown') },
          body: event.body ?? '',
          createdAt: event.createdAt,
          reviewState: event.reviewState ?? 'commented',
          comments: event.reviewComments ?? [],
          url: event.url ?? null,
        }]
      }

      return [{
        id: `event-${event.id}`,
        kind: 'event',
        event: toConversationEvent(event, currentPullRequest, t),
      }]
    })

    const sortedItems = [...comments, ...events].sort((left, right) =>
      getTimelineTime(left) - getTimelineTime(right)
    )

    return groupCommitItems(sortedItems, currentPullRequest, t)
  })
}

type Translate = ReturnType<typeof useI18n>['t']

type CommitTimelineItem = {
  id: string
  kind: 'commit'
  actor: ConversationActor
  createdAt: string
  commit: PullRequestCommitSummary
}

type UngroupedPullRequestTimelineItem = PullRequestTimelineItem | CommitTimelineItem

function groupCommitItems(
  items: UngroupedPullRequestTimelineItem[],
  pullRequest: PullRequestDetail,
  t: Translate,
): PullRequestTimelineItem[] {
  const groupedItems: PullRequestTimelineItem[] = []
  let pendingCommits: CommitTimelineItem[] = []
  const latestCommitId = findLatestCommitId(items)

  function flushCommits(): void {
    if (pendingCommits.length === 0) return

    groupedItems.push(toCommitGroupItem(pendingCommits, pullRequest, t, latestCommitId))
    pendingCommits = []
  }

  for (const item of items) {
    if (item.kind === 'commit') {
      pendingCommits.push(item)
      continue
    }

    flushCommits()
    groupedItems.push(item)
  }

  flushCommits()

  return groupedItems
}

function toCommitGroupItem(
  commits: CommitTimelineItem[],
  pullRequest: PullRequestDetail,
  t: Translate,
  latestCommitId: string | null,
): PullRequestTimelineItem {
  const firstCommit = commits[0]
  const lastCommit = commits[commits.length - 1]
  const sharedActor = findSharedCommitActor(commits)
  const fallbackActor = toConversationActor(pullRequest.author) ?? { login: t('pullRequest.values.unknown') }

  return {
    id: `commit-group-${firstCommit?.id ?? 'unknown'}-${lastCommit?.id ?? 'unknown'}`,
    kind: 'commit-group',
    actor: sharedActor ?? fallbackActor,
    createdAt: firstCommit?.createdAt ?? null,
    commits: commits.map((item) => withCommitStatusFallback(item.commit, pullRequest, latestCommitId)),
  }
}

function findLatestCommitId(items: UngroupedPullRequestTimelineItem[]): string | null {
  const latestCommit = [...items].reverse().find((item): item is CommitTimelineItem => item.kind === 'commit')

  return latestCommit?.commit.id ?? null
}

function withCommitStatusFallback(
  commit: PullRequestCommitSummary,
  pullRequest: PullRequestDetail,
  latestCommitId: string | null,
): PullRequestCommitSummary {
  if (commit.ciState || !pullRequest.status.ciState || commit.id !== latestCommitId) return commit

  return {
    ...commit,
    ciState: pullRequest.status.ciState,
  }
}

function findSharedCommitActor(commits: CommitTimelineItem[]): ConversationActor | null {
  const [firstCommit] = commits
  if (!firstCommit) return null

  const login = firstCommit.actor.login
  const hasOneActor = commits.every((item) => item.actor.login === login)

  return hasOneActor ? firstCommit.actor : null
}

function toConversationActor(actor: PullRequestActorSummary | null | undefined): ConversationActor | null {
  if (!actor?.login) return null

  return {
    login: actor.login,
    avatarUrl: actor.avatarUrl ?? undefined,
    isBot: actor.isBot ?? undefined,
  }
}

function toConversationReactions(
  reactions: PullRequestReactionSummary[] | null | undefined,
): ConversationReaction[] {
  return (reactions ?? []).map((reaction) => ({
    content: reaction.content,
    count: reaction.count,
    viewerHasReacted: reaction.viewerHasReacted,
  }))
}

function toConversationEvent(
  event: PullRequestTimelineEvent,
  currentPullRequest: PullRequestDetail,
  t: Translate,
): ConversationTimelineEvent {
  const eventConfig = timelineEventConfig(event)
  const reference = toConversationReference(event.source, currentPullRequest)

  return {
    id: String(event.id),
    actor: toConversationActor(event.actor),
    createdAt: event.createdAt,
    icon: eventConfig.icon,
    iconClass: eventConfig.iconClass,
    text: timelineEventText(event, t, Boolean(reference)),
    reference,
    url: event.url ?? null,
  }
}

function timelineEventConfig(event: PullRequestTimelineEvent): Pick<ConversationTimelineEvent, 'icon' | 'iconClass'> {
  switch (event.type) {
    case 'assigned':
      return { icon: UserPlus, iconClass: 'text-success' }
    case 'unassigned':
      return { icon: UserMinus, iconClass: 'text-muted-foreground' }
    case 'labeled':
    case 'unlabeled':
      return { icon: Tag, iconClass: 'text-info' }
    case 'closed':
      return { icon: CheckCircle2, iconClass: 'text-muted-foreground' }
    case 'merged':
      return { icon: GitMerge, iconClass: 'text-[color:var(--accent-purple)]' }
    case 'reopened':
      return { icon: RotateCcw, iconClass: 'text-success' }
    case 'renamed':
      return { icon: Pencil, iconClass: 'text-muted-foreground' }
    case 'cross-referenced':
    case 'connected':
    case 'disconnected':
      return { icon: Link2, iconClass: 'text-info' }
    case 'mentioned':
    case 'comment-deleted':
      return { icon: MessageSquare, iconClass: 'text-muted-foreground' }
    case 'reviewed':
    case 'review-dismissed':
      return { icon: ShieldCheck, iconClass: reviewToneClass(event.reviewState) }
    case 'review-requested':
    case 'review-request-removed':
      return { icon: Users, iconClass: 'text-info' }
    case 'ready-for-review':
      return { icon: GitPullRequest, iconClass: 'text-success' }
    case 'convert-to-draft':
      return { icon: GitPullRequestDraft, iconClass: 'text-muted-foreground' }
    case 'committed':
      return { icon: GitCommitHorizontal, iconClass: 'text-info' }
    case 'base-ref-changed':
    case 'base-ref-deleted':
    case 'base-ref-force-pushed':
    case 'head-ref-deleted':
    case 'head-ref-force-pushed':
    case 'head-ref-restored':
    case 'automatic-base-change-failed':
    case 'automatic-base-change-succeeded':
      return { icon: GitBranch, iconClass: 'text-muted-foreground' }
    case 'auto-merge-enabled':
    case 'auto-rebase-enabled':
    case 'auto-squash-enabled':
    case 'added-to-merge-queue':
      return { icon: GitMerge, iconClass: 'text-[color:var(--accent-purple)]' }
    case 'auto-merge-disabled':
    case 'removed-from-merge-queue':
      return { icon: GitMerge, iconClass: 'text-muted-foreground' }
    case 'referenced':
      return { icon: GitCommitHorizontal, iconClass: 'text-info' }
    case 'locked':
      return { icon: Lock, iconClass: 'text-muted-foreground' }
    case 'unlocked':
      return { icon: LockOpen, iconClass: 'text-muted-foreground' }
    case 'pinned':
      return { icon: Pin, iconClass: 'text-info' }
    case 'unpinned':
      return { icon: PinOff, iconClass: 'text-muted-foreground' }
    case 'transferred':
      return { icon: GitPullRequest, iconClass: 'text-muted-foreground' }
    case 'marked-as-duplicate':
    case 'unmarked-as-duplicate':
      return { icon: Copy, iconClass: 'text-muted-foreground' }
    case 'deployed':
    case 'deployment-environment-changed':
      return { icon: Rocket, iconClass: 'text-info' }
    case 'converted-to-discussion':
      return { icon: MessagesSquare, iconClass: 'text-info' }
    case 'added-to-project':
    case 'removed-from-project':
    case 'project-status-changed':
      return { icon: SquareKanban, iconClass: 'text-muted-foreground' }
    default:
      return { icon: CircleDot, iconClass: 'text-muted-foreground' }
  }
}

function timelineEventText(event: PullRequestTimelineEvent, t: Translate, hasReference = false): string {
  const fallback = event.text?.trim() || event.body?.trim() || t('pullRequest.timeline.generic')

  switch (event.type) {
    case 'assigned':
      return t('pullRequest.timeline.assigned', { target: actorName(event.assignee, t) })
    case 'unassigned':
      return t('pullRequest.timeline.unassigned', { target: actorName(event.assignee, t) })
    case 'labeled':
      return t('pullRequest.timeline.labeled', { label: event.label ?? t('pullRequest.values.unknown') })
    case 'unlabeled':
      return t('pullRequest.timeline.unlabeled', { label: event.label ?? t('pullRequest.values.unknown') })
    case 'closed':
      return t('pullRequest.timeline.closed')
    case 'merged':
      return event.afterCommit
        ? t('pullRequest.timeline.mergedWithCommit', { commit: event.afterCommit })
        : t('pullRequest.timeline.merged')
    case 'reopened':
      return t('pullRequest.timeline.reopened')
    case 'renamed':
      return t('pullRequest.timeline.renamed', {
        from: event.from ?? t('pullRequest.values.unknown'),
        to: event.to ?? t('pullRequest.values.unknown'),
      })
    case 'cross-referenced':
      if (hasReference) return t('pullRequest.timeline.crossReferencedAction')

      return t('pullRequest.timeline.crossReferenced', { source: referenceText(event.source, t) })
    case 'mentioned':
      return t('pullRequest.timeline.mentioned')
    case 'reviewed':
      return t('pullRequest.timeline.reviewed', { state: reviewStateLabel(event.reviewState, t) })
    case 'review-requested':
      return t('pullRequest.timeline.reviewRequested', { target: actorName(event.reviewer, t) })
    case 'review-request-removed':
      return t('pullRequest.timeline.reviewRequestRemoved', { target: actorName(event.reviewer, t) })
    case 'review-dismissed':
      return t('pullRequest.timeline.reviewDismissed', { state: reviewStateLabel(event.reviewState, t) })
    case 'ready-for-review':
      return t('pullRequest.timeline.readyForReview')
    case 'convert-to-draft':
      return t('pullRequest.timeline.convertToDraft')
    case 'committed':
      return event.commit
        ? t('pullRequest.timeline.committedCommit', { commit: event.commit.abbreviatedOid })
        : t('pullRequest.timeline.committed')
    case 'base-ref-changed':
      return t('pullRequest.timeline.baseRefChanged', {
        from: event.from ?? t('pullRequest.values.unknown'),
        to: event.to ?? t('pullRequest.values.unknown'),
      })
    case 'base-ref-deleted':
      return t('pullRequest.timeline.baseRefDeleted', { ref: event.ref ?? t('pullRequest.values.unknown') })
    case 'base-ref-force-pushed':
      return t('pullRequest.timeline.baseRefForcePushed', {
        ref: event.ref ?? t('pullRequest.values.unknown'),
        from: event.beforeCommit ?? t('pullRequest.values.unknown'),
        to: event.afterCommit ?? t('pullRequest.values.unknown'),
      })
    case 'head-ref-deleted':
      return t('pullRequest.timeline.headRefDeleted', { ref: event.ref ?? t('pullRequest.values.unknown') })
    case 'head-ref-force-pushed':
      return t('pullRequest.timeline.headRefForcePushed', {
        ref: event.ref ?? t('pullRequest.values.unknown'),
        from: event.beforeCommit ?? t('pullRequest.values.unknown'),
        to: event.afterCommit ?? t('pullRequest.values.unknown'),
      })
    case 'head-ref-restored':
      return t('pullRequest.timeline.headRefRestored')
    case 'automatic-base-change-failed':
      return t('pullRequest.timeline.automaticBaseChangeFailed', {
        from: event.from ?? t('pullRequest.values.unknown'),
        to: event.to ?? t('pullRequest.values.unknown'),
      })
    case 'automatic-base-change-succeeded':
      return t('pullRequest.timeline.automaticBaseChangeSucceeded', {
        from: event.from ?? t('pullRequest.values.unknown'),
        to: event.to ?? t('pullRequest.values.unknown'),
      })
    case 'auto-merge-enabled':
      return t('pullRequest.timeline.autoMergeEnabled')
    case 'auto-merge-disabled':
      return event.reason
        ? t('pullRequest.timeline.autoMergeDisabledWithReason', { reason: event.reason })
        : t('pullRequest.timeline.autoMergeDisabled')
    case 'auto-rebase-enabled':
      return t('pullRequest.timeline.autoRebaseEnabled')
    case 'auto-squash-enabled':
      return t('pullRequest.timeline.autoSquashEnabled')
    case 'added-to-merge-queue':
      return t('pullRequest.timeline.addedToMergeQueue')
    case 'removed-from-merge-queue':
      return event.reason
        ? t('pullRequest.timeline.removedFromMergeQueueWithReason', { reason: event.reason })
        : t('pullRequest.timeline.removedFromMergeQueue')
    case 'milestoned':
      return t('pullRequest.timeline.milestoned', { milestone: event.milestone ?? t('pullRequest.values.unknown') })
    case 'demilestoned':
      return t('pullRequest.timeline.demilestoned', { milestone: event.milestone ?? t('pullRequest.values.unknown') })
    case 'connected':
      if (hasReference) return t('pullRequest.timeline.connectedAction')

      return t('pullRequest.timeline.connected', { source: referenceText(event.source, t) })
    case 'disconnected':
      if (hasReference) return t('pullRequest.timeline.disconnectedAction')

      return t('pullRequest.timeline.disconnected', { source: referenceText(event.source, t) })
    case 'comment-deleted':
      return t('pullRequest.timeline.commentDeleted')
    case 'referenced':
      return event.afterCommit
        ? t('pullRequest.timeline.referencedCommit', { commit: event.afterCommit })
        : t('pullRequest.timeline.referenced')
    case 'locked':
      return event.reason
        ? t('pullRequest.timeline.lockedWithReason', { reason: event.reason })
        : t('pullRequest.timeline.locked')
    case 'unlocked':
      return t('pullRequest.timeline.unlocked')
    case 'pinned':
      return t('pullRequest.timeline.pinned')
    case 'unpinned':
      return t('pullRequest.timeline.unpinned')
    case 'transferred':
      return t('pullRequest.timeline.transferred', { from: event.from ?? t('pullRequest.values.unknown') })
    case 'marked-as-duplicate':
      if (hasReference) return t('pullRequest.timeline.markedAsDuplicateAction')

      return t('pullRequest.timeline.markedAsDuplicate', { source: referenceText(event.source, t) })
    case 'unmarked-as-duplicate':
      if (hasReference) return t('pullRequest.timeline.unmarkedAsDuplicateAction')

      return t('pullRequest.timeline.unmarkedAsDuplicate', { source: referenceText(event.source, t) })
    case 'deployed':
      return event.to
        ? t('pullRequest.timeline.deployedTo', { environment: event.to })
        : t('pullRequest.timeline.deployed')
    case 'deployment-environment-changed':
      return t('pullRequest.timeline.deploymentEnvironmentChanged', {
        environment: event.to ?? t('pullRequest.values.unknown'),
      })
    case 'converted-to-discussion':
      if (hasReference) return t('pullRequest.timeline.convertedToDiscussionAction')

      return t('pullRequest.timeline.convertedToDiscussion', { source: referenceText(event.source, t) })
    case 'added-to-project':
      return event.to
        ? t('pullRequest.timeline.addedToProject', { project: event.to })
        : t('pullRequest.timeline.addedToProjectGeneric')
    case 'removed-from-project':
      return event.from
        ? t('pullRequest.timeline.removedFromProject', { project: event.from })
        : t('pullRequest.timeline.removedFromProjectGeneric')
    case 'project-status-changed':
      return event.from
        ? t('pullRequest.timeline.projectStatusChanged', {
            from: event.from,
            to: event.to ?? t('pullRequest.values.unknown'),
            project: event.label ?? t('pullRequest.values.unknown'),
          })
        : t('pullRequest.timeline.projectStatusSet', {
            to: event.to ?? t('pullRequest.values.unknown'),
            project: event.label ?? t('pullRequest.values.unknown'),
          })
    default:
      return fallback
  }
}

function toConversationReference(
  source: PullRequestTimelineReference | string | null | undefined,
  currentPullRequest: PullRequestDetail,
): ConversationReference | null {
  if (!source || typeof source === 'string') return null
  if (source.type === 'discussion') return null

  const parsedUrl = source.url ? parseGitHubReferenceUrl(source.url) : null
  const [sourceOwner, sourceRepo] = splitRepository(source.repository)
  const owner = parsedUrl?.owner ?? sourceOwner ?? currentPullRequest.owner
  const repo = parsedUrl?.repo ?? sourceRepo ?? currentPullRequest.repo
  const number = parsedUrl?.number ?? source.number ?? null

  if (!owner || !repo || !number || number <= 0) return null

  const kindHint = parsedUrl?.kindHint ?? normalizeReferenceKind(source.type)

  return {
    owner,
    repo,
    number,
    kindHint,
    kind: kindHint,
    title: source.title ?? null,
    url: source.url ?? parsedUrl?.url ?? null,
  }
}

function normalizeReferenceKind(type: PullRequestTimelineReference['type']): GitHubRepositoryReferenceKind | undefined {
  if (type === 'pull-request') return 'pull-request'
  if (type === 'issue') return 'issue'

  return undefined
}

function splitRepository(repository: string | null | undefined): [string | null, string | null] {
  const [owner, repo] = String(repository ?? '').split('/')

  return owner && repo ? [owner, repo] : [null, null]
}

function referenceText(source: PullRequestTimelineReference | string | null | undefined, t: Translate): string {
  if (!source) return t('pullRequest.values.unknown')
  if (typeof source === 'string') return source

  const number = source.number ? `#${source.number}` : ''
  const repository = source.repository ? `${source.repository} ` : ''

  return `${repository}${number || source.title || t('pullRequest.values.unknown')}`.trim()
}

function actorName(actor: PullRequestActorSummary | null | undefined, t: Translate): string {
  return actor?.login ?? t('pullRequest.values.unknown')
}

function reviewStateLabel(state: GitHubPullRequestReviewState | null | undefined, t: Translate): string {
  return t(`pullRequest.reviewStates.${state ?? 'commented'}`)
}

function reviewToneClass(state: GitHubPullRequestReviewState | null | undefined): string {
  if (state === 'approved') return 'text-success'
  if (state === 'changes_requested') return 'text-destructive'
  if (state === 'dismissed') return 'text-muted-foreground'

  return 'text-info'
}

function getTimelineTime(item: UngroupedPullRequestTimelineItem): number {
  const value = item.kind === 'event' ? item.event.createdAt : item.createdAt

  const timestamp = new Date(value ?? '').getTime()

  return Number.isNaN(timestamp) ? 0 : timestamp
}
