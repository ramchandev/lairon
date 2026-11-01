import { Field } from '@/components/FormPage'
import { SearchSelect } from '@/components/SearchSelect'
import {
  divisionOptions,
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
 * Division, Qualification and Speciality are independent searchable lists (no mapping): any doctor can be in any division.
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
  return (
    <>
      <Field label="Division" error={errors?.division}>
        <SearchSelect
          title="Division"
          placeholder="Select division"
          value={value.division}
          options={divisionOptions(data).map(opt)}
          onChange={(division) => onChange({ ...value, division })}
        />
      </Field>
      <Field label="Qualification" error={errors?.qualification}>
        <SearchSelect
          title="Qualification"
          placeholder="Select qualification"
          allowOther
          value={value.qualification}
          options={qualificationOptions(data).map(opt)}
          onChange={(qualification) => onChange({ ...value, qualification })}
        />
      </Field>
      <Field label="Speciality" full error={errors?.speciality}>
        <SearchSelect
          title="Speciality"
          placeholder="Select speciality"
          allowOther
          value={value.speciality}
          options={specialityOptions(data).map(opt)}
          onChange={(speciality) => onChange({ ...value, speciality })}
        />
      </Field>
    </>
  )
}
