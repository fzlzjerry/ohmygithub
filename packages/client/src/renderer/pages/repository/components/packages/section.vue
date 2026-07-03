<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, ArrowLeft, Container, Package as PackageIcon } from 'lucide-vue-next'
import { Badge, Button } from '@oh-my-github/ui'
import { useToast } from '@/composables/use-toast'
import {
  restorePackage,
  restorePackageVersion,
  usePackageVersionsQuery,
  useRepositoryPackagesQuery,
} from '@/composables/github/use-packages'
import PackageDeleteDialog, { type PackageDeleteTarget } from './package-delete-dialog.vue'
import PackageList from './package-list.vue'
import VersionList from './version-list.vue'

const props = defineProps<{
  isActive: boolean
  owner: string
  repo: string
}>()

const PACKAGE_PER_PAGE = 20
const VERSION_PER_PAGE = 30

const { t } = useI18n()
const toast = useToast()

const page = ref(1)
const versionPage = ref(1)
const selectedPackage = ref<GitHubPackage | null>(null)
const deleteTarget = ref<PackageDeleteTarget | null>(null)
const isDeleteDialogOpen = ref(false)

const hasRepositoryIdentity = computed(() => Boolean(props.owner && props.repo))

const packagesQuery = useRepositoryPackagesQuery({
  owner: () => props.owner,
  repo: () => props.repo,
  page,
  perPage: PACKAGE_PER_PAGE,
  enabled: hasRepositoryIdentity,
})

const versionsQuery = usePackageVersionsQuery({
  owner: () => props.owner,
  packageType: () => selectedPackage.value?.packageType ?? 'npm',
  packageName: () => selectedPackage.value?.name ?? '',
  page: versionPage,
  perPage: VERSION_PER_PAGE,
  enabled: () => hasRepositoryIdentity.value && selectedPackage.value !== null,
})

const packageResult = computed(() => packagesQuery.data.value ?? null)
const packages = computed(() => packageResult.value?.items ?? [])
const packagesTotalCount = computed(() => packageResult.value?.totalCount ?? 0)
const packagesHasNextPage = computed(() => packageResult.value?.hasNextPage ?? false)
const packagesErrorMessage = computed(() => extractErrorMessage(packagesQuery.error.value))
const packagesHasError = computed(() => Boolean(packagesErrorMessage.value))
const isPackagesScopeError = computed(() => isScopeErrorMessage(packagesErrorMessage.value))
const isPackagesLoading = computed(() => packagesQuery.isLoading.value)
const failedTypes = computed(() => packageResult.value?.failedTypes ?? [])
const failedTypesText = computed(() => failedTypes.value.join(', '))
const isTruncated = computed(() => packageResult.value?.truncated ?? false)

const versionResult = computed(() => versionsQuery.data.value ?? null)
const versions = computed(() => versionResult.value?.items ?? [])
const versionsHasNextPage = computed(() => versionResult.value?.hasNextPage ?? false)
const versionsHasError = computed(() => Boolean(versionsQuery.error.value))
const isVersionsLoading = computed(() => versionsQuery.isLoading.value)
const versionsSyntheticTotalCount = computed(() =>
  (versionPage.value - 1) * VERSION_PER_PAGE
  + versions.value.length
  + (versionsHasNextPage.value ? VERSION_PER_PAGE : 0)
)

const selectedPackageIcon = computed(() =>
  selectedPackage.value?.packageType === 'container' || selectedPackage.value?.packageType === 'docker'
    ? Container
    : PackageIcon
)

watch(
  () => [props.owner, props.repo] as const,
  () => {
    page.value = 1
    selectedPackage.value = null
    versionPage.value = 1
  },
)

function openVersions(pkg: GitHubPackage): void {
  selectedPackage.value = pkg
  versionPage.value = 1
}

function closeVersions(): void {
  selectedPackage.value = null
  versionPage.value = 1
}

function retryPackages(): void {
  void packagesQuery.refetch()
}

function retryVersions(): void {
  void versionsQuery.refetch()
}

function requestDeletePackage(pkg: GitHubPackage): void {
  deleteTarget.value = { kind: 'package', package: pkg }
  isDeleteDialogOpen.value = true
}

function requestDeleteVersion(version: GitHubPackageVersion): void {
  if (!selectedPackage.value) return

  deleteTarget.value = { kind: 'version', package: selectedPackage.value, version }
  isDeleteDialogOpen.value = true
}

function handleDeleted(target: PackageDeleteTarget): void {
  isDeleteDialogOpen.value = false

  if (target.kind === 'package') {
    void packagesQuery.refetch()
    showUndoToast(
      t('repository.packages.toasts.packageDeleted', { name: target.package.name }),
      () => void handleRestorePackage(target.package),
    )
    return
  }

  void versionsQuery.refetch()
  showUndoToast(
    t('repository.packages.toasts.versionDeleted', { name: target.version.name }),
    () => void handleRestoreVersion(target.package, target.version),
  )
}

function showUndoToast(message: string, onUndo: () => void): void {
  toast.success(message, {
    action: {
      label: t('repository.packages.toasts.undo'),
      onClick: onUndo,
    },
  })
}

async function handleRestorePackage(pkg: GitHubPackage): Promise<void> {
  try {
    await restorePackage(props.owner, pkg.packageType, pkg.name)
    toast.success(t('repository.packages.toasts.packageRestored', { name: pkg.name }))
  } catch (error) {
    toast.error(extractErrorMessage(error) ?? t('repository.packages.toasts.restoreError'))
  } finally {
    void packagesQuery.refetch()
  }
}

async function handleRestoreVersion(pkg: GitHubPackage, version: GitHubPackageVersion): Promise<void> {
  try {
    await restorePackageVersion(props.owner, pkg.packageType, pkg.name, version.id)
    toast.success(t('repository.packages.toasts.versionRestored', { name: version.name }))
  } catch (error) {
    toast.error(extractErrorMessage(error) ?? t('repository.packages.toasts.restoreError'))
  } finally {
    void versionsQuery.refetch()
  }
}

function isScopeErrorMessage(message: string | null): boolean {
  return Boolean(message) && /403|scope/i.test(message ?? '')
}

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (!(error instanceof Error)) return null

  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
    .trim()

  return message || null
}
</script>

<template>
  <section class="grid gap-3">
    <template v-if="!selectedPackage">
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="grid min-w-0 gap-1">
          <h2 class="select-none truncate text-title font-semibold text-foreground">
            {{ t('repository.packages.title') }}
          </h2>
          <p class="select-none text-body text-muted-foreground">
            {{ t('repository.packages.description') }}
          </p>
        </div>
      </div>

      <div
        v-if="failedTypes.length > 0"
        class="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-body text-foreground"
      >
        <AlertTriangle class="mt-0.5 size-4 shrink-0 text-warning" />
        <p class="text-muted-foreground">
          {{ t('repository.packages.warnings.failedTypes', { types: failedTypesText }) }}
        </p>
      </div>

      <p
        v-if="isTruncated"
        class="text-body text-muted-foreground"
      >
        {{ t('repository.packages.warnings.truncated') }}
      </p>

      <PackageList
        :disabled="!hasRepositoryIdentity"
        :has-error="packagesHasError"
        :has-identity="hasRepositoryIdentity"
        :has-next-page="packagesHasNextPage"
        :is-loading="isPackagesLoading"
        :is-scope-error="isPackagesScopeError"
        :packages="packages"
        :page="page"
        :per-page="PACKAGE_PER_PAGE"
        :total-count="packagesTotalCount"
        @delete="requestDeletePackage"
        @retry="retryPackages"
        @update:page="page = $event"
        @view-versions="openVersions"
      />
    </template>

    <template v-else>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          :aria-label="t('repository.packages.versions.back')"
          size="icon-sm"
          type="button"
          variant="ghost"
          @click="closeVersions"
        >
          <ArrowLeft class="size-3.5" />
        </Button>
        <component
          :is="selectedPackageIcon"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <h2 class="min-w-0 truncate text-title font-semibold text-foreground">
          {{ selectedPackage.name }}
        </h2>
        <Badge
          size="sm"
          variant="outline"
        >
          {{ selectedPackage.packageType }}
        </Badge>
        <Badge
          size="sm"
          variant="secondary"
        >
          {{ t(`repository.packages.visibility.${selectedPackage.visibility}`) }}
        </Badge>
      </div>

      <VersionList
        :has-error="versionsHasError"
        :has-next-page="versionsHasNextPage"
        :is-loading="isVersionsLoading"
        :page="versionPage"
        :per-page="VERSION_PER_PAGE"
        :total-count="versionsSyntheticTotalCount"
        :versions="versions"
        @delete="requestDeleteVersion"
        @retry="retryVersions"
        @update:page="versionPage = $event"
      />
    </template>

    <PackageDeleteDialog
      :open="isDeleteDialogOpen"
      :owner="owner"
      :target="deleteTarget"
      @deleted="handleDeleted"
      @update:open="isDeleteDialogOpen = $event"
    />
  </section>
</template>
