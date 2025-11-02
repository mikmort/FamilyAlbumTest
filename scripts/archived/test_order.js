// Lightweight test harness for computeOrderedTaggedPeople
// Run with: node scripts\test_order.js

function computeOrderedTaggedPeople(tagged, peopleList) {
  const taggedArr = tagged || [];
  if (!peopleList) return taggedArr;

  const order = peopleList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (order.length === 0) return taggedArr;

  const byName = new Map(taggedArr.map((p) => [p.neName, p]));
  const ordered = [];
  const used = new Set();

  for (const name of order) {
    const p = byName.get(name);
    if (p) {
      ordered.push(p);
      used.add(p.ID);
    }
  }

  // Append any tagged people not present in PPeopleList at the end
  for (const p of taggedArr) {
    if (!used.has(p.ID)) ordered.push(p);
  }

  return ordered;
}

function printCase(title, tagged, peopleList) {
  console.log('---', title, '---');
  console.log('PPeopleList:', JSON.stringify(peopleList));
  console.log('Tagged input:', JSON.stringify(tagged));
  const out = computeOrderedTaggedPeople(tagged, peopleList);
  console.log('Ordered:', JSON.stringify(out));
  console.log('');
}

const tagged = [
  { ID: 1, neName: 'Alice' },
  { ID: 2, neName: 'Bob' },
  { ID: 3, neName: 'Carol' },
  { ID: 4, neName: 'Eve' },
];

printCase('Exact order', tagged, 'Bob, Alice, Carol');
printCase('Partial order with extra', tagged, 'Carol, Mallory, Alice');
printCase('Blank PPeopleList', tagged, '');
printCase('Undefined PPeopleList', tagged, undefined);
printCase('Whitespace and commas', tagged, '  Alice  ,  ,  Eve  ,  Bob  ');

// Edge cases
printCase('Empty tagged', [], 'Alice, Bob');
printCase('Tagged not matching names', [{ ID: 99, neName: 'Zed' }], 'Alice, Bob');

console.log('Done.');
