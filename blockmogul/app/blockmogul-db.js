/* BlockMogul Database Bridge
   Fill in SUPABASE_URL and SUPABASE_ANON_KEY when you create the backend.
   Until then, the game keeps working in local demo mode. */

window.BlockMogulDB = (() => {
  const config = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
  };

  const enabled = () => Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && window.supabase);
  let client = null;

  function getClient() {
    if (!enabled()) return null;
    if (!client) client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return client;
  }

  function makePropertyId(parcel) {
    if (parcel.property_id) return parcel.property_id;
    const lat = Number(parcel.lat).toFixed(6);
    const lng = Number(parcel.lng).toFixed(6);
    return `geo_${lat}_${lng}`;
  }

  async function upsertProperty(parcel) {
    const db = getClient();
    if (!db) return { ok: false, localOnly: true };

    const payload = {
      property_id: makePropertyId(parcel),
      address: parcel.address || `Property #${parcel.id}`,
      lat: parcel.lat,
      lng: parcel.lng,
      property_type: parcel.type || 'Residential',
      condition_score: parcel.condition || 100,
      current_value: parcel.price || 0,
      monthly_rent: parcel.rent || 0,
      status: parcel.owner ? 'owned' : (parcel.foreclosure ? 'distressed' : 'available')
    };

    const { error } = await db.from('blockmogul_properties').upsert(payload, { onConflict: 'property_id' });
    return { ok: !error, error };
  }

  async function buyProperty(buyerId, parcel) {
    const db = getClient();
    if (!db) return { ok: false, localOnly: true, message: 'Local demo mode' };

    await upsertProperty(parcel);
    const propertyId = makePropertyId(parcel);
    const { data, error } = await db.rpc('buy_blockmogul_property', {
      p_buyer_id: buyerId,
      p_property_id: propertyId
    });
    if (error) return { ok: false, message: error.message };
    return data;
  }

  function subscribeToOwnershipChanges(onChange) {
    const db = getClient();
    if (!db) return null;

    return db.channel('blockmogul-global-properties')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blockmogul_properties' }, payload => {
        if (typeof onChange === 'function') onChange(payload);
      })
      .subscribe();
  }

  return { config, enabled, makePropertyId, upsertProperty, buyProperty, subscribeToOwnershipChanges };
})();
