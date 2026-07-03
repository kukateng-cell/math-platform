'use client'

import { useActionState, useState } from 'react'
import { createQuestion, updateQuestion, type AdminFormState } from '@/actions/admin'

type BaseSkill = { id: string; name: string }
type Question = {
  id: string
  skillId: string
  type: string
  prompt: string
  answer: string
  options: string | null
  paramsJson: string | null
  explanation: string | null
}

type Props =
  | { mode: 'create'; skills: BaseSkill[]; question?: never; onDone?: () => void }
  | { mode: 'edit'; skills: BaseSkill[]; question: Question; onDone: () => void }

export default function QuestionForm(props: Props) {
  const { skills, mode } = props

  const actionFn = mode === 'create' ? createQuestion : updateQuestion
  const [state, action, pending] = useActionState<AdminFormState, FormData>(actionFn, undefined)

  // 從現有 paramsJson 解析互動模式（編輯模式初始值）
  const initialInteraction = (() => {
    if (mode !== 'edit' || !props.question.paramsJson) return 'choice'
    try {
      return (JSON.parse(props.question.paramsJson).interaction as string) ?? 'choice'
    } catch { return 'choice' }
  })()
  const [interaction, setInteraction] = useState(initialInteraction)
  const [inputMode, setInputMode] = useState<'numeric' | 'text'>(() => {
    if (mode !== 'edit' || !props.question.paramsJson) return 'numeric'
    try {
      return (JSON.parse(props.question.paramsJson).inputMode as string) === 'text' ? 'text' : 'numeric'
    } catch { return 'numeric' }
  })

  if (state?.ok && mode === 'edit' && props.onDone) {
    props.onDone()
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {mode === 'edit' && <input type="hidden" name="id" value={props.question.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">技能 *</label>
          <select
            name="skillId"
            defaultValue={mode === 'edit' ? props.question.skillId : ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {mode === 'create' && (
              <option value="" disabled>
                選擇技能
              </option>
            )}
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">題型</label>
          {mode === 'edit' ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={
                  props.question.type === 'DIRECT' ? '直接題目' :
                  props.question.type === 'ADD' ? '參數化加法' :
                  props.question.type === 'SUB' ? '參數化減法' :
                  props.question.type === 'MUL' ? '參數化乘法' :
                  props.question.type === 'DIV' ? '參數化除法' :
                  props.question.type === 'WORD_PROBLEM' ? '參數化文字題' : props.question.type
                }
                readOnly
                disabled
                className="flex-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500"
              />
              <span className="text-xs text-neutral-400 dark:text-gray-500">不可變更</span>
            </div>
          ) : (
            <select name="type" defaultValue="DIRECT" className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
              <option value="DIRECT">直接題目</option>
              <option value="ADD">參數化加法</option>
              <option value="SUB">參數化減法</option>
              <option value="MUL">參數化乘法</option>
              <option value="DIV">參數化除法</option>
              <option value="WORD_PROBLEM">參數化文字題</option>
            </select>
          )}
        </div>
      </div>

      {/* 互動模式 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">互動模式</label>
          {mode === 'edit' ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={
                  interaction === 'numberline' ? '數字線' :
                  interaction === 'fillin' ? '填答鍵盤' : '選擇題'
                }
                readOnly
                disabled
                className="flex-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500"
              />
              <span className="text-xs text-neutral-400 dark:text-gray-500">不可變更</span>
            </div>
          ) : (
            <select
              name="interaction"
              value={interaction}
              onChange={(e) => setInteraction(e.target.value as 'choice' | 'numberline' | 'fillin')}
              className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="choice">選擇題</option>
              <option value="numberline">數字線</option>
              <option value="fillin">填答鍵盤</option>
            </select>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">選項（選擇題用，逗號分隔）</label>
          <input
            name="options"
            defaultValue={mode === 'edit' ? (props.question.options ?? '') : undefined}
            placeholder="留空為填答題"
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* 數字線範圍 */}
      {interaction === 'numberline' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">數字線最小值</label>
            <input
              name="rangeMin"
              type="number"
              defaultValue={mode === 'edit' && props.question.paramsJson
                ? (() => { try { return JSON.parse(props.question.paramsJson).rangeMin ?? 0 } catch { return 0 } })()
                : 0}
              className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">數字線最大值</label>
            <input
              name="rangeMax"
              type="number"
              defaultValue={mode === 'edit' && props.question.paramsJson
                ? (() => { try { return JSON.parse(props.question.paramsJson).rangeMax ?? 10 } catch { return 10 } })()
                : 10}
              className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* 填答輸入模式 */}
      {interaction === 'fillin' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">填答類型</label>
            {mode === 'edit' ? (
              <input
                type="text"
                value={inputMode === 'text' ? '文字輸入（鍵盤）' : '數字鍵盤'}
                readOnly
                disabled
                className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500"
              />
            ) : (
              <select
                name="inputMode"
                value={inputMode}
                onChange={(e) => setInputMode(e.target.value as 'numeric' | 'text')}
                className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="numeric">數字鍵盤（含小數點）</option>
                <option value="text">文字輸入（鍵盤）</option>
              </select>
            )}
          </div>
          {inputMode === 'text' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">placeholder（提示文字）</label>
              <input
                name="placeholder"
                defaultValue={mode === 'edit' && props.question.paramsJson
                  ? (() => { try { return JSON.parse(props.question.paramsJson).placeholder ?? '' } catch { return '' } })()
                  : ''}
                placeholder="例：輸入答案"
                className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">題目 *</label>
        <input
          name="prompt"
          defaultValue={mode === 'edit' ? props.question.prompt : undefined}
          placeholder="直接題目：3 + 4 = ?　參數化：{a} + {b} = ?"
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">答案 *</label>
        <input
          name="answer"
          defaultValue={mode === 'edit' ? props.question.answer : undefined}
          placeholder="直接題：7　參數化：{a+b}"
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">參數 JSON（參數化題用）</label>
        <input
          name="paramsJson"
          defaultValue={mode === 'edit' ? (props.question.paramsJson ?? '') : undefined}
          placeholder='{"aMin":1,"aMax":5,"bMin":1,"bMax":5,"sumMax":10}'
          className="rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">解析</label>
        <input
          name="explanation"
          defaultValue={mode === 'edit' ? (props.question.explanation ?? '') : undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {state?.message && <p className="text-sm text-red-500">{state.message}</p>}
      {state?.ok && <p className="text-sm text-green-600">{mode === 'edit' ? '已更新！' : '已建立！'}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? '儲存中…' : mode === 'edit' ? '✓ 儲存變更' : '+ 新增題目'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={props.onDone}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            取消
          </button>
        )}
      </div>
    </form>
  )
}
