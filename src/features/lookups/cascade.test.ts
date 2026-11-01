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
  ],
  qualifications: [
    { id: 'q1', value: 'MD' },
    { id: 'q2', value: 'MS' },
  ],
  specialities: [
    { id: 's1', value: 'Cardiologist' },
    { id: 's2', value: 'Neurologist' },
  ],
}

describe('professional details lists', () => {
  it('lists active divisions plus All Division', () => {
    expect(divisionOptions(data)).toEqual(['OL', 'CC', ALL_DIVISION])
  })
  it('offers every qualification and speciality whatever the division (no mapping)', () => {
    expect(qualificationOptions(data)).toEqual(['MD', 'MS'])
    expect(specialityOptions(data)).toEqual(['Cardiologist', 'Neurologist'])
  })
})
