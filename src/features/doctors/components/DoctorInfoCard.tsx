import { Avatar } from '@/components/Avatar'
import { Person, Tag } from '@/components/ListParts'
import { splitList } from '@/lib/lists'
import { formatPhone } from '@/lib/phone'

export interface DoctorFacts {
  name: string
  phone?: string | null
  qualification?: string | null
  speciality?: string | null
  division?: string | null
  area?: string | null
  hospital_name?: string | null
  pharmacy_name?: string | null
  hq?: string | null
}

/** A selected doctor's details as a read-only text card (instead of editable form fields). */
export function DoctorInfoCard({ doctor }: { doctor: DoctorFacts }) {
  const facts: [string, React.ReactNode][] = [
    ['Qualification', doctor.qualification],
    [
      'Speciality',
      splitList(doctor.speciality).length ? (
        <span className="flex flex-wrap gap-1">
          {splitList(doctor.speciality).map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </span>
      ) : null,
    ],
    ['Division', doctor.division],
    ['Area', doctor.area],
    ['Hospital', doctor.hospital_name],
    ['Pharmacy', doctor.pharmacy_name],
    ['HQ', doctor.hq],
    ['Phone', doctor.phone ? formatPhone(doctor.phone) : null],
  ]
  return (
    <div
      className="field full rounded-[14px] border border-line bg-white/60 p-4"
      aria-label="Doctor details"
    >
      <Person lead={<Avatar name={doctor.name} />} name={doctor.name} />
      <dl className="meta-grid sm mt-3.5">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  )
}
