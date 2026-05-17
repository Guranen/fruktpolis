const { getSupabaseClient, json, computeSortedResults } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { success: false, error: 'Method not allowed' });

  try {
    const supabase = getSupabaseClient();
    const [{ count: totalVotes, error: totalVotesError }, { data: rankingData, error: rankingDataError }] = await Promise.all([
      supabase.from('votes').select('id', { count: 'exact', head: true }),
      supabase.from('vote_rankings').select('fruit_name, rank_position')
    ]);
    if (totalVotesError) throw totalVotesError;
    if (rankingDataError) throw rankingDataError;

    return json(200, {
      success: true,
      totalVotes: totalVotes || 0,
      sortedResults: computeSortedResults(rankingData || [])
    });
  } catch (error) {
    return json(500, { success: false, error: 'Kunde inte hämta resultat just nu.', details: error.message });
  }
};
