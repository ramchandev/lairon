import { Field } from '@/components/FormPage'
import { SearchSelect } from '@/components/SearchSelect'
import {
  divisionOptions,
  isFiltered,
  qualificationOptions,
  specialityOptions,
  useCascadeData,
} from '@/features/lookups/cascade'

export interface Professional {
  division: string
  qualification: string
  speciality: string
}

const opt = (v: string) => ({ value: v, label: v })

/**
 * Renders its fields straight into the parent Section's grid.
 * Division → Qualification → Speciality, narrowed by the admin's mapping (PLAN §6.7).
 * Changing Division clears Qualification and Speciality; changing Qualification clears Speciality.
 * Values are plain text snapshots; Qualification and Speciality always allow "Others".
 */
export function ProfessionalFields({
  value,
  onChange,
  errors,
}: {
  value: Professional
  onChange: (next: Professional) => void
  errors?: Partial<Record<keyof Professional, string>>
}) {
  const { data, isLoading } = useCascadeData()
  if (isLoading || !data)
    return (
      <div
        className="field full h-40 animate-pulse rounded-control bg-muted-bg/50"
        aria-busy="true"
      />
    )
  const note = isFiltered(data, value.division)
    ? `Filtered by the ${value.division} division mapping`
    : undefined

  return (
    <>
      <Field label="Division" error={errors?.division}>
        <SearchSelect
          title="Division"
          placeholder="Select division"
          value={value.division}
          options={divisionOptions(data).map(opt)}
          onChange={(division) => onChange({ division, qualification: '', speciality: '' })}
        />
      </Field>
      <Field label="Qualification" error={errors?.qualification}>
        <SearchSelect
          title="Qualification"
          placeholder="Select qualification"
          allowOther
          note={note}
          value={value.qualification}
          options={qualificationOptions(data, value.division).map(opt)}
          onChange={(qualification) => onChange({ ...value, qualification, speciality: '' })}
        />
      </Field>
      <Field label="Speciality" full error={errors?.speciality}>
        <SearchSelect
          title="Speciality"
          placeholder="Select speciality"
          allowOther
          note={note}
          value={value.speciality}
          options={specialityOptions(data, value.division, value.qualification).map(opt)}
          onChange={(speciality) => onChange({ ...value, speciality })}
        />
      </Field>
    </>
  )
}
