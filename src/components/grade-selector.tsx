'use client'

import { useCallback } from 'react'
import { updateChildGrade } from '@/actions/auth'

const GRADES = [
  { value: 'K', label: '幼兒園' },
  { value: 'G1', label: '一年級' },
  { value: 'G2', label: '二年級' },
  { value: 'G3', label: '三年級' },
  { value: 'G4', label: '四年級' },
  { value: 'G5', label: '五年級' },
  { value: 'G6', label: '六年級' },
]

export default function GradeSelector({
  childId,
  currentGrade,
}: {
  childId: string
  currentGrade: string
}) {
  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const form = new FormData()
      form.set('childId', childId)
      form.set('gradeLevel', e.target.value)
      try {
        await updateChildGrade(form)
      } catch {
        // error handled silently; revert select value
        e.target.value = currentGrade
      }
    },
    [childId, currentGrade],
  )

  return (
    <form className="inline-flex items-center gap-1">
      <select
        name="gradeLevel"
        defaultValue={currentGrade}
        onChange={handleChange}
        className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      >
        {GRADES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-neutral-400" title="點擊下拉選單調整年級">
        ✏️
      </span>
    </form>
  )
}
