'use client'

export default function SkillFilter({
  skills,
  defaultValue,
  query,
}: {
  skills: { id: string; name: string }[]
  defaultValue: string
  query: string
}) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (val) params.set('skillId', val)
    params.set('page', '1')
    const qs = params.toString()
    window.location.href = `/admin/questions${qs ? `?${qs}` : ''}`
  }

  return (
    <select
      name="skillId"
      defaultValue={defaultValue}
      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      onChange={handleChange}
    >
      <option value="">全部技能</option>
      {skills.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  )
}
