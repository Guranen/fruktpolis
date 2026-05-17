const { FRUITS, getSupabaseClient, getIpFromHeaders, json, computeSortedResults } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { voter_id: voterId, ranking } = body;

    if (!voterId || typeof voterId !== 'string' || voterId.length < 10) {
      return json(400, { success: false, error: 'Ogiltigt voter_id.' });
    }
    if (!Array.isArray(ranking) || ranking.length !== FRUITS.length) {
      return json(400, { success: false, error: 'Ranking måste innehålla alla frukter exakt en gång.' });
    }
    const unique = new Set(ranking);
    if (unique.size !== FRUITS.length || ranking.some((f) => !FRUITS.includes(f))) {
      return json(400, { success: false, error: 'Ranking innehåller okända eller dubbla frukter.' });
    }

    const supabase = getSupabaseClient();
    const ipAddress = getIpFromHeaders(event.headers || {});

    const { data: existingVoter, error: existingVoterError } = await supabase
      .from('votes')
      .select('id')
      .eq('voter_id', voterId)
      .maybeSingle();
    if (existingVoterError) throw existingVoterError;
    if (existingVoter) return json(409, { success: false, error: 'Du har redan röstat med denna enhet.' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipVoteCount, error: ipCountError } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .gte('created_at', since);
    if (ipCountError) throw ipCountError;
    if ((ipVoteCount || 0) >= 3) return json(429, { success: false, error: 'För många röster från samma IP senaste 24 timmarna.' });

    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .insert({ voter_id: voterId, ip_address: ipAddress })
      .select('id')
      .single();
    if (voteError) throw voteError;

    const rankingRows = ranking.map((fruitName, i) => ({
      vote_id: vote.id,
      fruit_name: fruitName,
      rank_position: i + 1
    }));
    const { error: rankingsError } = await supabase.from('vote_rankings').insert(rankingRows);
    if (rankingsError) throw rankingsError;

    const [{ count: totalVotes, error: totalVotesError }, { data: rankingData, error: rankingDataError }] = await Promise.all([
      supabase.from('votes').select('id', { count: 'exact', head: true }),
      supabase.from('vote_rankings').select('fruit_name, rank_position')
    ]);
    if (totalVotesError) throw totalVotesError;
    if (rankingDataError) throw rankingDataError;

    return json(200, { success: true, totalVotes: totalVotes || 0, sortedResults: computeSortedResults(rankingData || []) });
  } catch (error) {
    return json(500, { success: false, error: 'Kunde inte spara röst just nu.', details: error.message });
  }
};
