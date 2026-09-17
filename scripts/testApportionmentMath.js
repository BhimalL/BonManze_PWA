// scripts/testApportionmentMath.js
// Table-driven unit test suite for net-price proportional apportionment math

import { apportionAmount, r2 } from '../utils/apportionment.js';

let passed = 0;
let failed = 0;

function assertEqualArrays(label, actual, expected) {
  const isMatch =
    actual.length === expected.length &&
    actual.every((val, i) => Math.abs(val - expected[i]) < 0.001);

  if (isMatch) {
    console.log(`  PASS  ${label} => [${actual.join(', ')}] (sum: ${r2(actual.reduce((a, b) => a + b, 0))})`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} -- expected [${expected.join(', ')}], got [${actual.join(', ')}]`);
    failed++;
  }
}

function assertSumEqualsTotal(label, actual, expectedTotal) {
  const sum = r2(actual.reduce((a, b) => a + b, 0));
  if (Math.abs(sum - expectedTotal) < 0.001) {
    console.log(`  PASS  ${label} -- total sum matches exact collected amount (${sum})`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} -- expected total ${expectedTotal}, got sum ${sum}`);
    failed++;
  }
}

console.log('\n--- Running Apportionment Math Unit Test Suite ---\n');

// Test Suite 1: Even 2-item split
console.log('1. Even 2-item Split Tests:');
{
  const items = [250, 250];
  
  // Full payment
  const resFull = apportionAmount(items, 500);
  assertEqualArrays('2-item even split (Full payment Rs 500)', resFull, [250, 250]);
  assertSumEqualsTotal('2-item even split (Full payment sum check)', resFull, 500);

  // Partial payment
  const resPartial = apportionAmount(items, 200);
  assertEqualArrays('2-item even split (Partial payment Rs 200)', resPartial, [100, 100]);
  assertSumEqualsTotal('2-item even split (Partial payment sum check)', resPartial, 200);
}

// Test Suite 2: 3-item repeating decimal split
console.log('\n2. 3-item Repeating Decimal Split Tests:');
{
  const items = [100, 100, 100];

  // Rs 100 collected across 3 equal items (100/3 = 33.333...)
  const res100 = apportionAmount(items, 100);
  assertEqualArrays('3-item repeating decimal (Rs 100 collected)', res100, [33.33, 33.33, 33.34]);
  assertSumEqualsTotal('3-item repeating decimal (Rs 100 sum check)', res100, 100);

  // Rs 200 collected across 3 equal items (200/3 = 66.666...)
  const res200 = apportionAmount(items, 200);
  assertEqualArrays('3-item repeating decimal (Rs 200 collected)', res200, [66.67, 66.67, 66.66]);
  assertSumEqualsTotal('3-item repeating decimal (Rs 200 sum check)', res200, 200);
}

// Test Suite 3: Single-item group
console.log('\n3. Single-item Group Tests:');
{
  const itemsArray = [500];
  const resSingle = apportionAmount(itemsArray, 250);
  assertEqualArrays('Single item (Rs 250 collected against Rs 500 net)', resSingle, [250]);
  assertSumEqualsTotal('Single item sum check', resSingle, 250);

  const itemsObject = [{ netAmount: 350 }];
  const resObj = apportionAmount(itemsObject, 350);
  assertEqualArrays('Single item object (Full Rs 350 collected)', resObj, [350]);
  assertSumEqualsTotal('Single item object sum check', resObj, 350);
}

// Test Suite 4: Multi-drop group scenario (Rs 1030 net total)
console.log('\n4. Multi-drop Group Scenario Tests (Rs 1030 net total):');
{
  // Equal multi-drop: two drops of Rs 515 each = Rs 1030 net total, Rs 518.08 collected
  const itemsEqual = [{ netAmount: 515 }, { netAmount: 515 }];
  const resEqual = apportionAmount(itemsEqual, 518.08);
  assertEqualArrays('Multi-drop equal split (Rs 518.08 collected on Rs 1030 total)', resEqual, [259.04, 259.04]);
  assertSumEqualsTotal('Multi-drop equal split sum check', resEqual, 518.08);

  // Unequal multi-drop: Drop 1 = Rs 600, Drop 2 = Rs 430 (Rs 1030 total), Rs 518.08 collected
  const itemsUnequal = [{ netAmount: 600 }, { netAmount: 430 }];
  const resUnequal = apportionAmount(itemsUnequal, 518.08);
  assertEqualArrays('Multi-drop unequal split (Rs 518.08 collected on 600/430)', resUnequal, [301.79, 216.29]);
  assertSumEqualsTotal('Multi-drop unequal split sum check', resUnequal, 518.08);
}

console.log(`\nApportionment Math Summary: ${passed} passed, ${failed} failed.\n`);

if (failed > 0) {
  process.exit(1);
}
