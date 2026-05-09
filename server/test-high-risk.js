const GenerateHighRiskResponse = require('./src/skills/GenerateHighRiskResponse');

(async () => {
  console.log('=== TESTING GenerateHighRiskResponse ===\n');

  // Test 1: English
  const enReply = await GenerateHighRiskResponse.execute("i'm going to hurt myself", {});
  console.log('ENGLISH:');
  console.log(enReply);
  const enSentences = enReply.split('.').filter(s => s.trim()).length;
  const enQuestions = (enReply.match(/\?/g) || []).length;
  console.log(`Sentences: ${enSentences}, Questions: ${enQuestions}`);
  console.log(`✓ PASS` + (enQuestions === 1 && enSentences <= 4 ? '' : ' ⚠️  ISSUE'));
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: French
  const frReply = await GenerateHighRiskResponse.execute("je vais me tuer", { language: 'french' });
  console.log('FRENCH:');
  console.log(frReply);
  const frSentences = frReply.split('.').filter(s => s.trim()).length;
  const frQuestions = (frReply.match(/\?/g) || []).length;
  console.log(`Sentences: ${frSentences}, Questions: ${frQuestions}`);
  console.log(`✓ PASS` + (frQuestions === 1 && frSentences <= 4 ? '' : ' ⚠️  ISSUE'));

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Darija
  const daReply = await GenerateHighRiskResponse.execute("نحس بروحي", { language: 'derja' });
  console.log('DARIJA:');
  console.log(daReply);
  const daQuestions = (daReply.match(/\?/g) || []).length;
  console.log(`Questions: ${daQuestions}`);
  console.log(`✓ PASS` + (daQuestions === 1 ? '' : ' ⚠️  ISSUE'));
})();
