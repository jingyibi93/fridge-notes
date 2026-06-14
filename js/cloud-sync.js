(function () {
  const config = window.FridgeSupabaseConfig || {};
  const status = {
    enabled: Boolean(config.enabled && config.url && config.anonKey),
    ready: false,
    syncing: false,
    lastSyncedAt: null,
    error: null
  };

  const clientIdKey = "fridge_memo_cloud_client_id";
  const clientId = localStorage.getItem(clientIdKey) || `client_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  localStorage.setItem(clientIdKey, clientId);

  let supabase = null;
  let channel = null;
  let pushTimer = null;
  let applyingRemote = false;

  function emitStatus() {
    window.dispatchEvent(new CustomEvent("fridge-cloud-status", { detail: { ...status } }));
  }

  function setStatus(patch) {
    Object.assign(status, patch);
    emitStatus();
  }

  function tableName() {
    return config.stateTable || "fridge_states";
  }

  function payloadFor(snapshot) {
    return {
      ...snapshot,
      syncClientId: clientId,
      syncedAt: Date.now()
    };
  }

  async function loadSupabase() {
    const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return module.createClient(config.url, config.anonKey);
  }

  async function ensureRemoteFridge(snapshot) {
    if (!supabase || !snapshot?.familyCode) return;
    const remote = await fetchRemoteFridge(snapshot.familyCode);
    const looksLikeFreshJoin = !snapshot.notes?.length && snapshot.name === `冰箱 ${snapshot.familyCode.slice(0, 4)}`;
    if (remote && looksLikeFreshJoin) {
      applyRemotePayload(remote);
      return;
    }

    const payload = payloadFor(snapshot);
    const { data, error } = await supabase
      .from(tableName())
      .upsert({
        family_code: snapshot.familyCode,
        fridge_name: snapshot.name,
        payload,
        updated_by: clientId,
        updated_at: new Date().toISOString()
      }, { onConflict: "family_code" })
      .select("payload")
      .single();

    if (error) throw error;
    if (data?.payload && data.payload.syncClientId !== clientId) {
      applyRemotePayload(data.payload);
    }
  }

  async function fetchRemoteFridge(familyCode) {
    if (!supabase || !familyCode) return null;
    const { data, error } = await supabase
      .from(tableName())
      .select("payload")
      .eq("family_code", familyCode)
      .maybeSingle();
    if (error) throw error;
    return data?.payload || null;
  }

  function applyRemotePayload(payload, force = false) {
    if (!payload || (!force && payload.syncClientId === clientId)) return;
    applyingRemote = true;
    window.FridgeStore.applyRemoteFridgeSnapshot(payload);
    applyingRemote = false;
    setStatus({ lastSyncedAt: Date.now(), error: null });
    window.dispatchEvent(new CustomEvent("fridge-cloud-updated", { detail: payload }));
  }

  function subscribe(familyCode) {
    if (!supabase || !familyCode) return;
    if (channel) supabase.removeChannel(channel);
    channel = supabase
      .channel(`fridge-state-${familyCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName(),
          filter: `family_code=eq.${familyCode}`
        },
        (message) => applyRemotePayload(message.new?.payload)
      )
      .subscribe((subscriptionStatus) => {
        setStatus({ ready: subscriptionStatus === "SUBSCRIBED", error: null });
      });
  }

  function schedulePush(snapshot) {
    if (!status.enabled || !supabase || applyingRemote || !snapshot?.familyCode) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        setStatus({ syncing: true, error: null });
        await ensureRemoteFridge(snapshot);
        subscribe(snapshot.familyCode);
        setStatus({ syncing: false, lastSyncedAt: Date.now(), error: null });
      } catch (error) {
        setStatus({ syncing: false, error: error.message || "同步失败" });
      }
    }, 450);
  }

  async function syncCurrentFridge() {
    if (!status.enabled) return;
    try {
      setStatus({ syncing: true, error: null });
      const local = window.FridgeStore.activeFridgeSnapshot();
      if (!local?.familyCode) {
        if (channel) supabase.removeChannel(channel);
        channel = null;
        setStatus({ syncing: false, ready: false, lastSyncedAt: null, error: null });
        return;
      }
      const remote = await fetchRemoteFridge(local.familyCode);
      if (remote && (remote.updatedAt || 0) > (local.updatedAt || 0)) {
        applyRemotePayload(remote);
      } else {
        await ensureRemoteFridge(local);
      }
      subscribe(local.familyCode);
      setStatus({ syncing: false, lastSyncedAt: Date.now(), error: null });
    } catch (error) {
      setStatus({ syncing: false, error: error.message || "同步失败" });
    }
  }

  async function joinFridgeByCode(familyCode) {
    if (!status.enabled) return false;
    try {
      setStatus({ syncing: true, error: null });
      if (!supabase) supabase = await loadSupabase();
      const cleanCode = String(familyCode || "").trim().toUpperCase();
      const remote = await fetchRemoteFridge(cleanCode);
      if (remote) {
        applyRemotePayload(remote, true);
        subscribe(cleanCode);
        setStatus({ syncing: false, ready: true, lastSyncedAt: Date.now(), error: null });
        return true;
      }
      await ensureRemoteFridge(window.FridgeStore.activeFridgeSnapshot());
      subscribe(cleanCode);
      setStatus({ syncing: false, lastSyncedAt: Date.now(), error: null });
      return false;
    } catch (error) {
      setStatus({ syncing: false, error: error.message || "加入失败" });
      return false;
    }
  }

  async function boot() {
    if (!status.enabled) {
      emitStatus();
      return;
    }

    try {
      setStatus({ syncing: true, error: null });
      supabase = await loadSupabase();
      window.FridgeStore.setCloudPersistHandler(schedulePush);
      await syncCurrentFridge();
    } catch (error) {
      setStatus({ enabled: false, syncing: false, ready: false, error: error.message || "无法连接 Supabase" });
    }
  }

  window.FridgeCloudSync = {
    status,
    clientId,
    syncCurrentFridge,
    joinFridgeByCode,
    schedulePush
  };

  window.addEventListener("fridge-active-fridge-changed", syncCurrentFridge);
  boot();
}());
