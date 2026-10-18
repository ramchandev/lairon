export type Template =
  | 'welcome'
  | 'service_request_submitted'
  | 'service_request_decided'
  | 'starter_pack_submitted'
  | 'starter_pack_fulfilled'
  | 'leave_applied'
  | 'leave_decided'

export interface WelcomeData { name: string; link: string }
export interface ServiceRow { doctor: string; hospital: string; area: string; serviceType: string; amount: number; terms: string }
export interface ServiceRequestData {
  refNo: string
  status: 'submitted' | 'approved' | 'rejected' | 'fulfilled'
  managerName: string
  accountabilityName: string
  total: number
  services: ServiceRow[]
  note?: string | null
  /** Where the recipient can open it. Omitted for people who have no screen for it (e.g. accountable staff). */
  link?: string | null
}
export interface StarterPackData {
  refNo: string; date: string; doctor: string; qualification: string; doctorArea: string
  staffName: string; staffArea: string; division: string
  items: { name: string; quantity: string }[]
  note?: string | null
  link?: string | null
}
export interface LeaveData {
  driverName: string; from: string; to: string; days: number; type: string; reason: string
  status?: 'approved' | 'rejected'
  note?: string | null
  link?: string | null
}

export interface TemplateData {
  welcome: WelcomeData
  service_request_submitted: ServiceRequestData
  service_request_decided: ServiceRequestData
  starter_pack_submitted: StarterPackData
  starter_pack_fulfilled: StarterPackData
  leave_applied: LeaveData
  leave_decided: LeaveData
}

export interface Planned<T extends Template = Template> {
  template: T
  to: string
  data: TemplateData[T]
  /** Stable key: the same notification is only ever SENT once to the same person. */
  dedupeKey: string
  entity: string
  entityId: string
}
