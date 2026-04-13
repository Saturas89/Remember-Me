const questions = Array.from({ length: 10000 }, (_, i) => ({ id: `q${i}`, text: `Question ${i}` }));
const localAnswers = {};
for (let i = 0; i < 5000; i++) {
  localAnswers[`q${i}`] = `Answer ${i}`;
}

const ITERATIONS = 100;

console.time('Baseline (Array.find)');
for(let iter=0; iter<ITERATIONS; iter++) {
  const answers = Object.entries(localAnswers)
    .filter(([, v]) => v.trim())
    .map(([questionId, value]) => {
      const q = questions.find(q => q.id === questionId)
      return { questionId, value, questionText: q?.text }
    });
}
console.timeEnd('Baseline (Array.find)');

console.time('Optimization (Map)');
for(let iter=0; iter<ITERATIONS; iter++) {
  const questionMap = new Map(questions.map(q => [q.id, q]));
  const answers = Object.entries(localAnswers)
    .filter(([, v]) => v.trim())
    .map(([questionId, value]) => {
      const q = questionMap.get(questionId);
      return { questionId, value, questionText: q?.text }
    });
}
console.timeEnd('Optimization (Map)');

console.time('Optimization (Record)');
for(let iter=0; iter<ITERATIONS; iter++) {
  const questionRecord = {};
  for(const q of questions) questionRecord[q.id] = q;
  const answers = Object.entries(localAnswers)
    .filter(([, v]) => v.trim())
    .map(([questionId, value]) => {
      const q = questionRecord[questionId];
      return { questionId, value, questionText: q?.text }
    });
}
console.timeEnd('Optimization (Record)');
