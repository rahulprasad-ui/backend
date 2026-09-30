const test = require('node:test');
const assert = require('node:assert/strict');
const SecretKeyService = require('../src/services/secretKey.service');

test('SecretKeyService - generateRandomKeyString produces secure unique format', () => {
  const key1 = SecretKeyService.generateRandomKeyString('RIV');
  const key2 = SecretKeyService.generateRandomKeyString('RIV');

  // Must match RIV-XXXX-XXXX-XXXX-XXXX pattern
  const pattern = /^RIV-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

  assert.match(key1, pattern, `Key 1 does not match expected format: ${key1}`);
  assert.match(key2, pattern, `Key 2 does not match expected format: ${key2}`);
  assert.notEqual(key1, key2, 'Two generated keys must not be identical');
});

test('SecretKeyService - normalizeKey cleans user input properly', () => {
  assert.equal(SecretKeyService.normalizeKey('  riv-9k7x-w3p8-2a4m-7q6l  '), 'RIV-9K7X-W3P8-2A4M-7Q6L');
  assert.equal(SecretKeyService.normalizeKey('riv_9k7x_w3p8_2a4m_7q6l'), 'RIV-9K7X-W3P8-2A4M-7Q6L');
  assert.equal(SecretKeyService.normalizeKey(''), '');
});

test('SecretKeyService - validation handles invalid input gracefully', async () => {
  const emptyRes = await SecretKeyService.verifyAndRedeemKey({ keyString: '', userId: 'u1' });
  assert.equal(emptyRes.success, false);
  assert.equal(emptyRes.code, 'EMPTY_KEY');

  const noAuthRes = await SecretKeyService.verifyAndRedeemKey({ keyString: 'RIV-XXXX-YYYY', userId: null });
  assert.equal(noAuthRes.success, false);
  assert.equal(noAuthRes.code, 'UNAUTHORIZED');
});
