import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useQuery } from '@pinia/colada'

export function useRepositoryPackagesQuery(options: {
  owner: MaybeRefOrGetter<string>
  repo: MaybeRefOrGetter<string>
  page: MaybeRefOrGetter<number>
  perPage: MaybeRefOrGetter<number>
  enabled: MaybeRefOrGetter<boolean>
}) {
  return useQuery<GitHubPackagePage>({
    key: () => [
      'github',
      'packages',
      'list',
      toValue(options.owner),
      toValue(options.repo),
      toValue(options.page),
      toValue(options.perPage),
    ],
    enabled: () =>
      Boolean(toValue(options.owner)) && Boolean(toValue(options.repo)) && toValue(options.enabled),
    // The upstream listing fans out to up to ~7 requests (one per package type,
    // paginated), so cache it a bit longer than the other repository queries.
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    query: async () => {
      assertPackagesBridge()

      return window.ohMyGithub.packages.listPackages({
        owner: toValue(options.owner),
        repo: toValue(options.repo),
        page: toValue(options.page),
        perPage: toValue(options.perPage),
      })
    },
  })
}

export function usePackageVersionsQuery(options: {
  owner: MaybeRefOrGetter<string>
  packageType: MaybeRefOrGetter<GitHubPackageType>
  packageName: MaybeRefOrGetter<string>
  page: MaybeRefOrGetter<number>
  perPage: MaybeRefOrGetter<number>
  enabled: MaybeRefOrGetter<boolean>
}) {
  return useQuery<GitHubPackageVersionPage>({
    key: () => [
      'github',
      'packages',
      'versions',
      toValue(options.owner),
      toValue(options.packageType),
      toValue(options.packageName),
      toValue(options.page),
      toValue(options.perPage),
    ],
    enabled: () =>
      Boolean(toValue(options.owner)) && Boolean(toValue(options.packageName)) && toValue(options.enabled),
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    query: async () => {
      assertPackagesBridge()

      return window.ohMyGithub.packages.listVersions({
        owner: toValue(options.owner),
        packageType: toValue(options.packageType),
        packageName: toValue(options.packageName),
        page: toValue(options.page),
        perPage: toValue(options.perPage),
      })
    },
  })
}

export async function deletePackage(
  owner: string,
  packageType: GitHubPackageType,
  packageName: string,
): Promise<void> {
  assertPackagesBridge()

  await window.ohMyGithub.packages.deletePackage({ owner, packageType, packageName })
}

export async function deletePackageVersion(
  owner: string,
  packageType: GitHubPackageType,
  packageName: string,
  versionId: number,
): Promise<void> {
  assertPackagesBridge()

  await window.ohMyGithub.packages.deleteVersion({ owner, packageType, packageName, versionId })
}

export async function restorePackage(
  owner: string,
  packageType: GitHubPackageType,
  packageName: string,
): Promise<void> {
  assertPackagesBridge()

  await window.ohMyGithub.packages.restorePackage({ owner, packageType, packageName })
}

export async function restorePackageVersion(
  owner: string,
  packageType: GitHubPackageType,
  packageName: string,
  versionId: number,
): Promise<void> {
  assertPackagesBridge()

  await window.ohMyGithub.packages.restoreVersion({ owner, packageType, packageName, versionId })
}

function assertPackagesBridge(): void {
  if (!window.ohMyGithub?.packages) {
    throw new Error('GitHub packages bridge is unavailable')
  }
}
