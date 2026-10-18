import {
  ALL_DIVISION,
  divisionOptions,
  qualificationOptions,
  specialityOptions,
  type CascadeData,
} from './cascade'

const data: CascadeData = {
  divisions: [
    { id: 'ol', name: 'OL' },
    { id: 'cc', name: 'CC' },
    { id: 'cd', name: 'CD' },
  ],
  qualifications: [
    { id: 'q1', value: 'MD' },
    { id: 'q2', value: 'MD DM' },
    { id: 'q3', value: 'MS' },
  ],
  specialities: [
    { id: 's1', value: 'Cardiologist' },
    { id: 's2', value: 'Neurologist' },
    { id: 's3', value: 'Surgeon' },
  ],
  pairs: [
    { division_id: 'ol', qualification_item_id: 'q2', speciality_item_id: 's2' },
    { division_id: 'ol', qualification_item_id: 'q1', speciality_item_id: 's1' },
    { division_id: 'ol', qualification_item_id: 'q1', speciality_item_id: 's3' },
  ],
}

describe('professional details cascade', () => {
  it('lists active divisions plus All Division', () => {
    expect(divisionOptions(data)).toEqual(['OL', 'CC', 'CD', ALL_DIVISION])
  })
  it('narrows qualifications to the division mapping', () => {
    expect(qualificationOptions(data, 'OL')).toEqual(['MD', 'MD DM'])
  })
  it('falls back to every qualification for All Division or an unmapped division', () => {
    expect(qualificationOptions(data, ALL_DIVISION)).toHaveLength(3)
    expect(qualificationOptions(data, 'CC')).toHaveLength(3)
    expect(qualificationOptions(data, '')).toHaveLength(3)
  })
  it('narrows specialities by division + qualification, then by division, then all', () => {
    expect(specialityOptions(data, 'OL', 'MD')).toEqual(['Cardiologist', 'Surgeon'])
    expect(specialityOptions(data, 'OL', 'MS')).toEqual(['Cardiologist', 'Neurologist', 'Surgeon']) // qualification has no pairs → division level
    expect(specialityOptions(data, 'OL', 'Typed by hand')).toEqual([
      'Cardiologist',
      'Neurologist',
      'Surgeon',
    ])
    expect(specialityOptions(data, 'CC', 'MD')).toHaveLength(3) // no mapping → all
  })
  it('matches names case-insensitively', () => {
    expect(specialityOptions(data, 'ol', 'md dm')).toEqual(['Neurologist'])
  })
})
