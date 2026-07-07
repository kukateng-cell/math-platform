import { isAnswerCorrect, normalizeAnswer } from '../src/lib/answer-i18n.ts'

const tests: [string, string, boolean][] = [
  // Counting
  ['5', '5', true],
  ['5 ', '5', true],
  [' 5', '5', true],

  // Fractions
  ['1/2', '1/2', true],
  ['0.5', '1/2', true],
  ['0.50', '1/2', true],
  ['2/4', '1/2', true],
  ['1.25', '5/4', true],
  ['5/4', '5/4', true],

  // Time
  ['4:45', '4h45m', true],
  ['4小時45分', '4h45m', true],
  ['4h45m', '4h45m', true],

  // Shapes
  ['正方形', '正方形', true],
  ['正方', '正方形', true],
  ['銳角三角形', '銳角三角形', true],

  // Numbers
  ['40', '40', true],
  ['1035', '1035', true],
  ['16.2', '16.2', true],

  // Negative
  ['-3', '-3', true],
  ['-5', '-5', true],
  ['0', '-0', true],

  // Spaces
  ['1 / 2', '1/2', true],
  ['1/2 ', '1/2', true],
  ['40 ', '40', true],

  // Edge cases from counting questions
  ['3', '3', true],
  ['8', '8', true],
  ['24', '24', true],
  ['15', '15', true],

  // Fraction display issues
  ['0.5', '0.5', true],
  ['.5', '0.5', true],

  // Synonym tests (edge case: prefix alias should not break full word)
  ['正方形', '正方形', true],
  ['正方', '正方形', true],
  ['正三角形', '正三角形', true],
  ['等邊三角形', '正三角形', true],
  ['等腰三角形', '等腰三角形', true],
  ['銳角三角形', '銳角三角形', true],
  ['直角三角形', '直角三角形', true],
  ['圓周長', '圓周長', true],
  ['周長', '圓周長', true],
]

let failed = 0
for (const [user, correct, expected] of tests) {
  const result = isAnswerCorrect(user, correct)
  if (result !== expected) {
    console.log('FAIL:', JSON.stringify(user), 'vs', JSON.stringify(correct),
      'normUser:', normalizeAnswer(user),
      'normCorrect:', normalizeAnswer(correct))
    failed++
  }
}
console.log('Passed: ' + (tests.length - failed) + '/' + tests.length)
if (failed > 0) process.exit(1)
