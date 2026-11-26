/** Workload placement of an instance, the part of its key shared by a whole workload */
export interface InstanceWorkload {
  namespace: string
  resourceKind: string
  resourceName: string
}

/** Fields an instance gets from the VulnerabilityReport, null without a matching report row */
export interface InstanceDetails {
  container: string | null
  imageTag: string | null
  imageDigest: string | null
  package: string | null
  installedVersion: string | null
  fixedVersion: string | null
}

/** One sighting of a finding: workload x container x package x installed version */
export interface FindingInstance extends InstanceWorkload, InstanceDetails {
  id: number
  findingId: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
}
