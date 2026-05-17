const { createClient } = require('@supabase/supabase-js');

const FRUITS = [
  'Vindruvor','Vattenmelon','Banan','Körsbär','Kiwi','Mandarin Clementin Satsuma','Mango','Honungsmelon','Aprikos Persika Nektarin','Passionsfrukt','Granatäpple','Äpple','Päron','Grapefrukt','Ananas','Kokosnöt','Plommon','Apelsin','Physalis'
];

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getIpFromHeaders(headers = {}) {
  const candidates = [
    headers['x-nf-client-connection-ip'],
    headers['x-forwarded-for']?.split(',')[0]?.trim(),
    headers['client-ip'],
    headers['x-real-ip']
  ];
  return candidates.find(Boolean) || 'unknown';
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

function computeSortedResults(rows) {
  const totals = Object.fromEntries(FRUITS.map((name) => [name, { sum: 0, count: 0 }]));
  for (const row of rows) {
    if (!totals[row.fruit_name]) continue;
    totals[row.fruit_name].sum += Number(row.rank_position);
    totals[row.fruit_name].count += 1;
  }

  return FRUITS.map((name) => {
    const t = totals[name];
    const averageRank = t.count ? t.sum / t.count : FRUITS.length;
    return { fruitName: name, averageRank, voteCount: t.count };
  }).sort((a, b) => a.averageRank - b.averageRank);
}

module.exports = { FRUITS, getSupabaseClient, getIpFromHeaders, json, computeSortedResults };
