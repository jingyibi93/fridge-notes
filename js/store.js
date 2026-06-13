const STORAGE_KEY = "fridge_memo_app_state_v1";

const now = Date.now();
const MAGNET_ASSET_PATHS = [
  "assets/magnets/beer.png",
  "assets/magnets/yangjiaobao.png",
  "assets/magnets/pain.png",
  "assets/magnets/milk.png",
  "assets/magnets/coffee.png",
  "assets/magnets/kersong.png",
  "assets/magnets/strawberry.png",
  "assets/magnets/bread.png",
  "assets/magnets/egg.png?v=trim",
  "assets/magnets/bread2.png?v=trim",
  "assets/magnets/kiwi-fruit.png?v=trim",
  "assets/magnets/tanghulu.png?v=trim",
  "assets/magnets/cookie.png?v=trim",
  "assets/magnets/donut.png?v=trim",
  "assets/magnets/basket.png",
  "assets/magnets/croissant.png",
  "assets/magnets/espresso.png",
  "assets/magnets/pain-bag.png",
  "assets/magnets/tart.png",
  "assets/magnets/toaster.png",
  "assets/magnets/tomato-bag.png"
];

const storeMagnetAssets = MAGNET_ASSET_PATHS;

const defaultMembers = [
  { id: "m1", name: "我", color: "#a83232", left: false }
];

const emptyFridgeState = {
  fridgeName: "",
  familyCode: "",
  activeFridgeId: "",
  activeMemberId: "m1",
  maxZ: 20,
  notifications: [],
  firedReminderIds: [],
  favoriteArchive: [],
  members: cloneMembers(),
  notes: [],
  fridges: []
};

function cloneMembers() {
  return JSON.parse(JSON.stringify(defaultMembers));
}

const defaultState = emptyFridgeState;

let state = loadState();
let cloudPersistHandler = null;
let suppressCloudPersist = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeFlatState(source) {
  return {
    ...source,
    fridgeName: source.fridgeName || source.name || "",
    familyCode: normalizeFamilyCode(source.familyCode || source.inviteCode || ""),
    activeFridgeId: normalizeFamilyCode(source.activeFridgeId || source.familyCode || source.inviteCode || ""),
    members: (source.members?.length ? source.members : cloneMembers()).map((member) => ({
      left: false,
      ...member
    })),
    notes: (source.notes?.length ? source.notes : []).map((note) => ({
      comments: [],
      checkedItems: {},
      mentions: [],
      isFavorite: false,
      favoriteAt: null,
      favoriteDate: null,
      ...note
    })),
    notifications: source.notifications || [],
    firedReminderIds: source.firedReminderIds || [],
    favoriteArchive: (source.favoriteArchive || []).map((note) => ({
      comments: [],
      checkedItems: {},
      mentions: [],
      isFavorite: true,
      ...note
    }))
  };
}

function fridgeSnapshot(source = state) {
  return {
    id: normalizeFamilyCode(source.familyCode) || makeFamilyCode(),
    name: source.fridgeName || "",
    familyCode: normalizeFamilyCode(source.familyCode) || "",
    activeMemberId: source.activeMemberId,
    maxZ: source.maxZ || 20,
    notifications: source.notifications || [],
    firedReminderIds: source.firedReminderIds || [],
    favoriteArchive: source.favoriteArchive || [],
    members: source.members || [],
    notes: source.notes || [],
    updatedAt: Date.now()
  };
}

function normalizeFridge(source, index = 0) {
  const flat = normalizeFlatState({
    ...source,
    familyCode: source.familyCode || source.inviteCode || source.id,
    fridgeName: source.name || source.fridgeName || (index === 0 ? "小家的冰箱" : `冰箱 ${index + 1}`)
  });
  return {
    ...fridgeSnapshot(flat),
    id: normalizeFamilyCode(source.id || flat.familyCode) || flat.familyCode,
    updatedAt: source.updatedAt || Date.now()
  };
}

function buildFridges(source, activeFlat) {
  const rawFridges = Array.isArray(source.fridges) ? source.fridges : [];
  const seen = new Set();
  const fridges = rawFridges.map((fridge, index) => normalizeFridge(fridge, index)).filter((fridge) => {
    if (seen.has(fridge.id)) return false;
    seen.add(fridge.id);
    return true;
  });
  if (activeFlat.familyCode && !seen.has(activeFlat.familyCode)) fridges.unshift(normalizeFridge(activeFlat, 0));
  return fridges;
}

function applyFridge(fridge) {
  state.fridgeName = fridge.name;
  state.familyCode = fridge.familyCode;
  state.activeFridgeId = fridge.id;
  state.activeMemberId = fridge.activeMemberId;
  state.maxZ = fridge.maxZ;
  state.notifications = fridge.notifications || [];
  state.firedReminderIds = fridge.firedReminderIds || [];
  state.favoriteArchive = fridge.favoriteArchive || [];
  state.members = fridge.members || [];
  state.notes = fridge.notes || [];
}

function setCloudPersistHandler(handler) {
  cloudPersistHandler = typeof handler === "function" ? handler : null;
}

function activeFridgeSnapshot() {
  saveActiveFridge();
  if (!state.familyCode) return null;
  return fridgeSnapshot(state);
}

function applyRemoteFridgeSnapshot(snapshot) {
  if (!snapshot) return false;
  const remote = normalizeFridge(snapshot);
  const index = state.fridges.findIndex((fridge) => fridge.id === remote.id || fridge.familyCode === remote.familyCode);
  if (index >= 0) state.fridges[index] = remote;
  else state.fridges.unshift(remote);

  if (state.activeFridgeId === remote.id || state.familyCode === remote.familyCode) {
    applyFridge(remote);
  }

  suppressCloudPersist = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  suppressCloudPersist = false;
  return true;
}

function saveActiveFridge() {
  if (!state?.fridges) return;
  if (!state.familyCode) return;
  const snapshot = fridgeSnapshot(state);
  const index = state.fridges.findIndex((fridge) => fridge.id === snapshot.id);
  if (index >= 0) state.fridges[index] = snapshot;
  else state.fridges.unshift(snapshot);
  state.activeFridgeId = snapshot.id;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : clone(defaultState);
    if (!raw) return clone(defaultState);
    if (parsed.familyCode === "FRIDGE08" && (!Array.isArray(parsed.fridges) || parsed.fridges.every((fridge) => fridge.familyCode === "FRIDGE08"))) {
      return clone(defaultState);
    }
    const flat = normalizeFlatState(parsed);
    const fridges = buildFridges(parsed, flat).filter((fridge) => fridge.familyCode !== "FRIDGE08");
    if (!fridges.length) return clone(defaultState);
    const activeId = normalizeFamilyCode(parsed.activeFridgeId || flat.familyCode);
    const activeFridge = fridges.find((fridge) => fridge.id === activeId) || fridges[0];
    return {
      ...flat,
      ...fridgeSnapshot(activeFridge),
      fridgeName: activeFridge.name,
      activeFridgeId: activeFridge.id,
      fridges
    };
  } catch (error) {
    return clone(defaultState);
  }
}

function persist() {
  saveActiveFridge();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const snapshot = activeFridgeSnapshot();
  if (!suppressCloudPersist && cloudPersistHandler && snapshot) {
    cloudPersistHandler(snapshot);
  }
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function makeFamilyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function normalizeFamilyCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function randomCuteMagnet() {
  return storeMagnetAssets[Math.floor(Math.random() * storeMagnetAssets.length)];
}

function favoriteDateKey(time = Date.now()) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getState() {
  return state;
}

function getActiveMember() {
  return state.members.find((member) => member.id === state.activeMemberId) || state.members[0];
}

function getMember(memberId) {
  return state.members.find((member) => member.id === memberId) || state.members[0];
}

function setActiveMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  member.left = false;
  state.activeMemberId = memberId;
  persist();
}

function leaveMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return null;
  member.left = true;
  persist();
  return member;
}

function rejoinMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return null;
  member.left = false;
  state.activeMemberId = memberId;
  persist();
  return member;
}

function updateActiveMemberProfile({ name, color }) {
  const member = getActiveMember();
  if (!member) return null;
  const cleanName = String(name || "").trim();
  if (cleanName) member.name = cleanName.slice(0, 8);
  if (color) member.color = color;
  member.left = false;
  persist();
  return member;
}

function createFamily(code, name) {
  saveActiveFridge();
  const cleanCode = normalizeFamilyCode(code);
  const familyCode = cleanCode.length === 8 ? cleanCode : makeFamilyCode();
  state.fridgeName = String(name || "").trim() || "新的冰箱";
  state.familyCode = familyCode;
  state.activeFridgeId = familyCode;
  state.activeMemberId = "m1";
  state.members = cloneMembers();
  state.notes = [];
  state.notifications = [];
  state.firedReminderIds = [];
  state.maxZ = 20;
  persist();
  return state.familyCode;
}

function joinFamily(code) {
  saveActiveFridge();
  const cleanCode = normalizeFamilyCode(code);
  if (cleanCode.length !== 8) return null;
  const knownFridge = state.fridges.find((fridge) => fridge.familyCode === cleanCode || fridge.id === cleanCode);
  if (knownFridge) {
    applyFridge(knownFridge);
    rejoinMember(state.activeMemberId);
    return cleanCode;
  }
  state.fridgeName = `冰箱 ${cleanCode.slice(0, 4)}`;
  state.familyCode = cleanCode;
  state.activeFridgeId = cleanCode;
  state.activeMemberId = "m1";
  state.members = cloneMembers();
  state.notes = [];
  state.notifications = [];
  state.firedReminderIds = [];
  state.maxZ = 20;
  persist();
  return cleanCode;
}

function selectFridge(fridgeId) {
  saveActiveFridge();
  const cleanId = normalizeFamilyCode(fridgeId);
  const fridge = state.fridges.find((item) => item.id === cleanId || item.familyCode === cleanId);
  if (!fridge) return null;
  applyFridge(fridge);
  persist();
  return state.familyCode;
}

function getFridgeSummaries() {
  saveActiveFridge();
  return state.fridges.map((fridge) => {
    const activeMember = fridge.members.find((member) => member.id === fridge.activeMemberId) || fridge.members[0];
    const unread = (fridge.notifications || []).filter((item) =>
      !item.read && (!item.targetMemberId || item.targetMemberId === activeMember?.id)
    ).length;
    const latestNoteTime = Math.max(0, ...(fridge.notes || []).map((note) => note.updatedAt || note.time || 0));
    return {
      id: fridge.id,
      name: fridge.name,
      familyCode: fridge.familyCode,
      memberColors: (fridge.members || []).slice(0, 4).map((member) => member.color),
      unread,
      noteCount: (fridge.notes || []).length,
      updatedAt: latestNoteTime || fridge.updatedAt || Date.now(),
      active: fridge.id === state.activeFridgeId
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

function deleteFridge(fridgeId) {
  saveActiveFridge();
  const cleanId = normalizeFamilyCode(fridgeId);
  if (state.fridges.length <= 1) return { deleted: false, reason: "last" };
  const index = state.fridges.findIndex((item) => item.id === cleanId || item.familyCode === cleanId);
  if (index < 0) return { deleted: false, reason: "missing" };
  const deleted = state.fridges[index];
  state.fridges.splice(index, 1);
  if (deleted.id === state.activeFridgeId || deleted.familyCode === state.familyCode) {
    applyFridge(state.fridges[0]);
  }
  persist();
  return { deleted: true, activeFridgeId: state.activeFridgeId };
}

function createNote({ type, text, reminderTime }) {
  const member = getActiveMember();
  const mentions = extractMentions(text);
  const note = {
    id: uid("n"),
    itemType: "note",
    type,
    text,
    time: Date.now(),
    updatedAt: Date.now(),
    reminderTime: reminderTime || null,
    x: 42 + Math.random() * 24,
    y: 20 + Math.random() * 34,
    z: ++state.maxZ,
    rotate: Math.round((Math.random() * 6 - 3) * 10) / 10,
    width: 116 + Math.floor(Math.random() * 24),
    authorId: member.id,
    preserved: false,
    isFavorite: false,
    favoriteAt: null,
    favoriteDate: null,
    pin: randomCuteMagnet(),
    checkedItems: {},
    comments: [],
    mentions
  };
  state.notes.push(note);
  createPostMentionNotifications(note, member, text, mentions);
  persist();
  return note;
}

function createPhoto(label, imageData) {
  const member = getActiveMember();
  const mentions = extractMentions(label);
  const photo = {
    id: uid("p"),
    itemType: "photo",
    type: "photo",
    text: label,
    pin: randomCuteMagnet(),
    time: Date.now(),
    updatedAt: Date.now(),
    x: 36 + Math.random() * 36,
    y: 40 + Math.random() * 30,
    z: ++state.maxZ,
    rotate: Math.round((Math.random() * 10 - 5) * 10) / 10,
    width: 88 + Math.floor(Math.random() * 16),
    authorId: member.id,
    preserved: true,
    isFavorite: false,
    favoriteAt: null,
    favoriteDate: null,
    imageData: imageData || null,
    art: [
      "linear-gradient(145deg, #d6e5d2, #fff2d4 48%, #d9b887)",
      "linear-gradient(145deg, #efe3d1, #f6cfd5 50%, #b9d1e5)",
      "linear-gradient(145deg, #e7d4b7, #f7ede0 45%, #b8c8a8)"
    ][Math.floor(Math.random() * 3)],
    comments: [],
    mentions
  };
  state.notes.push(photo);
  createPostMentionNotifications(photo, member, label, mentions);
  persist();
  return photo;
}

function updateNote(noteId, patch) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return null;
  Object.assign(note, patch, { updatedAt: Date.now() });
  persist();
  return note;
}

function bringToFront(noteId) {
  return updateNote(noteId, { z: ++state.maxZ });
}

function deleteNote(noteId) {
  state.notes = state.notes.filter((note) => note.id !== noteId);
  persist();
}

function syncFavoriteArchive(note) {
  state.favoriteArchive = state.favoriteArchive || [];
  const snapshot = clone(note);
  snapshot.isFavorite = true;
  const index = state.favoriteArchive.findIndex((item) => item.id === note.id);
  if (index >= 0) state.favoriteArchive[index] = snapshot;
  else state.favoriteArchive.unshift(snapshot);
}

function removeFavoriteArchive(noteId) {
  state.favoriteArchive = (state.favoriteArchive || []).filter((note) => note.id !== noteId);
}

function toggleFavorite(noteId) {
  state.favoriteArchive = state.favoriteArchive || [];
  const note = state.notes.find((item) => item.id === noteId);
  const archived = state.favoriteArchive.find((item) => item.id === noteId);

  if (note?.isFavorite || archived?.isFavorite) {
    if (note) {
      note.isFavorite = false;
      note.favoriteAt = null;
      note.favoriteDate = null;
      note.updatedAt = Date.now();
    }
    removeFavoriteArchive(noteId);
    persist();
    return { favorite: false, note: note || archived };
  }

  if (!note) return null;
  const now = Date.now();
  note.isFavorite = true;
  note.favoriteAt = now;
  note.favoriteDate = favoriteDateKey(now);
  note.updatedAt = now;
  syncFavoriteArchive(note);
  persist();
  return { favorite: true, note };
}

function getFavoriteNotes() {
  const archived = state.favoriteArchive || [];
  const activeFavorites = state.notes.filter((note) => note.isFavorite);
  const map = new Map();
  [...archived, ...activeFavorites].forEach((note) => {
    map.set(note.id, {
      comments: [],
      checkedItems: {},
      mentions: [],
      ...note,
      isFavorite: true,
      favoriteDate: note.favoriteDate || favoriteDateKey(note.favoriteAt || note.time)
    });
  });
  return Array.from(map.values()).sort((a, b) => (b.favoriteAt || b.time) - (a.favoriteAt || a.time));
}

function getFavoriteGroups() {
  const groups = {};
  getFavoriteNotes().forEach((note) => {
    const key = note.favoriteDate || favoriteDateKey(note.favoriteAt || note.time);
    groups[key] = groups[key] || [];
    groups[key].push(note);
  });
  return groups;
}

function getFavoritesByDate(dateKey) {
  return getFavoriteGroups()[dateKey] || [];
}

function toggleChecklistItem(noteId, index) {
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return null;
  note.checkedItems = note.checkedItems || {};
  note.checkedItems[index] = !note.checkedItems[index];
  note.updatedAt = Date.now();
  persist();
  return note;
}

function addComment(noteId, text) {
  const note = state.notes.find((item) => item.id === noteId);
  const member = getActiveMember();
  if (!note || !text.trim()) return null;
  const mentions = extractMentions(text);
  note.comments = note.comments || [];
  note.comments.push({
    id: uid("c"),
    authorId: member.id,
    text: text.trim(),
    time: Date.now(),
    mentions
  });
  note.updatedAt = Date.now();
  createCommentNotifications(note, member, text.trim(), mentions);
  persist();
  return note;
}

function extractMentions(text) {
  return state.members
    .filter((member) => text.includes(`@${member.name}`))
    .map((member) => member.id);
}

function pushNotification(notification) {
  state.notifications.unshift({
    id: uid("notice"),
    time: Date.now(),
    read: false,
    ...notification
  });
}

function createCommentNotifications(note, author, text, mentions) {
  mentions.forEach((memberId) => {
    if (memberId === author.id) return;
    pushNotification({
      type: "mention",
      noteId: note.id,
      targetMemberId: memberId,
      title: `${author.name} 提到了你`,
      body: text
    });
  });

  if (note.authorId !== author.id && !mentions.includes(note.authorId)) {
    pushNotification({
      type: "comment",
      noteId: note.id,
      targetMemberId: note.authorId,
      title: `${author.name} 留言了`,
      body: text
    });
  }
}

function createPostMentionNotifications(note, author, text, mentions) {
  mentions.forEach((memberId) => {
    if (memberId === author.id) return;
    pushNotification({
      type: "mention",
      noteId: note.id,
      targetMemberId: memberId,
      title: `${author.name} 在新贴里提到了你`,
      body: text
    });
  });
}

function syncReminderNotifications() {
  const now = Date.now();
  let changed = false;
  state.firedReminderIds = state.firedReminderIds || [];
  state.notes.forEach((note) => {
    if (note.type !== "reminder" || !note.reminderTime || note.reminderTime > now) return;
    if (state.firedReminderIds.includes(note.id)) return;
    state.firedReminderIds.push(note.id);
    changed = true;
    pushNotification({
      type: "reminder",
      noteId: note.id,
      targetMemberId: null,
      title: "提醒事项到时间了",
      body: note.text
    });
  });
  if (changed) persist();
}

function getVisibleNotifications() {
  const activeMember = getActiveMember();
  return (state.notifications || []).filter((item) =>
    !item.targetMemberId || item.targetMemberId === activeMember.id
  );
}

function markNotificationRead(notificationId) {
  const notification = state.notifications.find((item) => item.id === notificationId);
  if (notification) notification.read = true;
  persist();
}

function markAllNotificationsRead() {
  const visibleIds = getVisibleNotifications().map((item) => item.id);
  state.notifications.forEach((item) => {
    if (visibleIds.includes(item.id)) item.read = true;
  });
  persist();
}

function sameDay(firstTime, secondTime = Date.now()) {
  const first = new Date(firstTime);
  const second = new Date(secondTime);
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function tidyRegionFor(note, mode) {
  if (mode === "media-split") {
    return note.itemType === "photo"
      ? { xMin: 18, xMax: 82, yMin: 60, yMax: 82 }
      : { xMin: 18, xMax: 82, yMin: 13, yMax: 34 };
  }

  if (mode === "fresh-split") {
    return note.preserved || sameDay(note.time)
      ? { xMin: 18, xMax: 82, yMin: 13, yMax: 34 }
      : { xMin: 18, xMax: 82, yMin: 60, yMax: 82 };
  }

  if (mode === "type-zones") {
    if (note.itemType === "photo") return { xMin: 52, xMax: 82, yMin: 50, yMax: 78 };
    if (note.type === "shopping") return { xMin: 52, xMax: 82, yMin: 16, yMax: 42 };
    if (note.type === "reminder") return { xMin: 18, xMax: 48, yMin: 50, yMax: 78 };
    return { xMin: 18, xMax: 48, yMin: 16, yMax: 42 };
  }

  return { xMin: 18, xMax: 82, yMin: 16, yMax: 78 };
}

function regionKey(region) {
  return `${region.xMin}-${region.xMax}-${region.yMin}-${region.yMax}`;
}

function positionInRegion(region, index, count) {
  const columns = Math.max(1, count <= 3 ? count : Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellWidth = (region.xMax - region.xMin) / columns;
  const cellHeight = (region.yMax - region.yMin) / rows;
  const jitterX = (Math.random() - .5) * cellWidth * .22;
  const jitterY = (Math.random() - .5) * cellHeight * .18;
  return {
    x: Math.min(86, Math.max(14, region.xMin + cellWidth * (column + .5) + jitterX)),
    y: Math.min(86, Math.max(12, region.yMin + cellHeight * (row + .5) + jitterY))
  };
}

function tidyNotes(mode = "random") {
  const groups = new Map();
  state.notes.forEach((note) => {
    const region = tidyRegionFor(note, mode);
    const key = regionKey(region);
    if (!groups.has(key)) groups.set(key, { region, notes: [] });
    groups.get(key).notes.push(note);
  });

  groups.forEach(({ region, notes }) => {
    notes.forEach((note, index) => {
      const position = positionInRegion(region, index, notes.length);
      note.x = position.x;
      note.y = position.y;
      note.z = ++state.maxZ;
      note.rotate = Math.round((Math.random() * 6 - 3) * 10) / 10;
      note.updatedAt = Date.now();
    });
  });

  persist();
}

window.FridgeStore = {
  getState,
  getActiveMember,
  getMember,
  setActiveMember,
  leaveMember,
  rejoinMember,
  updateActiveMemberProfile,
  createFamily,
  joinFamily,
  selectFridge,
  getFridgeSummaries,
  deleteFridge,
  setCloudPersistHandler,
  activeFridgeSnapshot,
  applyRemoteFridgeSnapshot,
  createNote,
  createPhoto,
  updateNote,
  bringToFront,
  deleteNote,
  toggleFavorite,
  getFavoriteNotes,
  getFavoriteGroups,
  getFavoritesByDate,
  toggleChecklistItem,
  addComment,
  syncReminderNotifications,
  getVisibleNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  tidyNotes
};
