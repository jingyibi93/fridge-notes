const homeScreen = document.querySelector("#homeScreen");
const homeCreateButton = document.querySelector("#homeCreateButton");
const homeJoinButton = document.querySelector("#homeJoinButton");
const homeFridgeManageButton = document.querySelector("#homeFridgeManageButton");
const homeFridgeCount = document.querySelector("#homeFridgeCount");
const homeDim = document.querySelector("#homeDim");
const homeSetupSheet = document.querySelector("#homeSetupSheet");
const homeSetupTitle = document.querySelector("#homeSetupTitle");
const homeInviteLabel = document.querySelector("#homeInviteLabel");
const homeSetupCodeInput = document.querySelector("#homeSetupCodeInput");
const homeFridgeNameField = document.querySelector("#homeFridgeNameField");
const homeFridgeNameInput = document.querySelector("#homeFridgeNameInput");
const homeSetupNameInput = document.querySelector("#homeSetupNameInput");
const homeColorGrid = document.querySelector("#homeColorGrid");
const homeSetupCancelButton = document.querySelector("#homeSetupCancelButton");
const homeSetupConfirmButton = document.querySelector("#homeSetupConfirmButton");
const board = document.querySelector("#board");
const scrim = document.querySelector("#scrim");
const composerSheet = document.querySelector("#composerSheet");
const memberSheet = document.querySelector("#memberSheet");
const fridgeManagerSheet = document.querySelector("#fridgeManagerSheet");
const fridgeManagerList = document.querySelector("#fridgeManagerList");
const closeFridgeManagerButton = document.querySelector("#closeFridgeManagerButton");
const notificationSheet = document.querySelector("#notificationSheet");
const reader = document.querySelector("#reader");
const readerLabel = document.querySelector("#readerLabel");
const readerBody = document.querySelector("#readerBody");
const preserveButton = document.querySelector("#preserveButton");
const deleteButton = document.querySelector("#deleteButton");
const favoriteButton = document.querySelector("#favoriteButton");
const noteTextInput = document.querySelector("#noteTextInput");
const reminderInput = document.querySelector("#reminderInput");
const reminderField = document.querySelector("#reminderField");
const noteTypeGroup = document.querySelector("#noteTypeGroup");
const contentLabel = document.querySelector("#contentLabel");
const composerTitle = document.querySelector("#composerTitle");
const saveNoteButton = document.querySelector("#saveNoteButton");
const photoUploadButton = document.querySelector("#photoUploadButton");
const photoInput = document.querySelector("#photoInput");
const composerMentionMenu = document.querySelector("#composerMentionMenu");
const memberList = document.querySelector("#memberList");
const memberInitial = document.querySelector("#memberInitial");
const activeFridgeTitle = document.querySelector("#activeFridgeTitle");
const familyCode = document.querySelector("#familyCode");
const copyFamilyCodeButton = document.querySelector("#copyFamilyCodeButton");
const leaveFridgeButton = document.querySelector("#leaveFridgeButton");
const notificationDot = document.querySelector("#notificationDot");
const notificationList = document.querySelector("#notificationList");
const closeNotificationButton = document.querySelector("#closeNotificationButton");
const markAllReadButton = document.querySelector("#markAllReadButton");
const commentList = document.querySelector("#commentList");
const commentInput = document.querySelector("#commentInput");
const sendCommentButton = document.querySelector("#sendCommentButton");
const mentionMenu = document.querySelector("#mentionMenu");
const toast = document.querySelector("#toast");
const memoryButton = document.querySelector("#memoryButton");
const memoryPage = document.querySelector("#memoryPage");
const closeMemoryButton = document.querySelector("#closeMemoryButton");
const memoryMonthTitle = document.querySelector("#memoryMonthTitle");
const memoryCalendar = document.querySelector("#memoryCalendar");
const prevMemoryMonthButton = document.querySelector("#prevMemoryMonthButton");
const nextMemoryMonthButton = document.querySelector("#nextMemoryMonthButton");
const memoryDetail = document.querySelector("#memoryDetail");
const closeMemoryDetailButton = document.querySelector("#closeMemoryDetailButton");
const memoryDetailDate = document.querySelector("#memoryDetailDate");
const memoryDetailList = document.querySelector("#memoryDetailList");
document.documentElement.dataset.appVersion = "20260612-cloud-mvp";

const placeholders = {
  message: "写点今天想被看见的小事...",
  shopping: "分行罗列购物清单",
  reminder: "写点害怕忘记的事情"
};

const tidyModes = [
  { value: "random", label: "随机分布" },
  { value: "media-split", label: "上便签，下照片" },
  { value: "fresh-split", label: "今日和冰鲜在上" },
  { value: "type-zones", label: "按类型分区" }
];

let activeNoteType = "message";
let activeReaderNoteId = null;
let composerMode = "note";
let selectedPhotoData = null;
let activeMentionInput = null;
let activeMentionMenu = null;
let toastTimer = null;
let homeSetupMode = "create";
let selectedHomeColor = "#a83232";
let memoryMonth = new Date();
let tidyModeIndex = -1;

function enterFridge() {
  homeScreen.classList.add("done");
  window.setTimeout(() => {
    homeScreen.hidden = true;
  }, 420);
}

function formatHomeTime(time) {
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(key) {
  const [year, month, day] = key.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderHomeFridges() {
  const fridges = window.FridgeStore.getFridgeSummaries();
  homeFridgeCount.textContent = `${fridges.length} 个`;
  fridgeManagerList.innerHTML = fridges.map((fridge) => `
    <article class="fridge-manager-card ${fridge.active ? "active" : ""}" data-fridge-id="${fridge.id}">
      <div class="fridge-manager-main">
        <strong>${escapeHtml(fridge.name)}</strong>
        <span>${fridge.noteCount} 张贴 · ${formatHomeTime(fridge.updatedAt)}</span>
        <em>${escapeHtml(fridge.familyCode)}</em>
        <div class="home-fridge-members">
          ${fridge.memberColors.map((color) => `<i style="--member-color:${escapeHtml(color)}"></i>`).join("")}
        </div>
        ${fridge.unread ? `<b>${fridge.unread}</b>` : ""}
      </div>
      <div class="fridge-manager-actions">
        <button type="button" data-fridge-open="${fridge.id}">${fridge.active ? "当前" : "进入"}</button>
        <button type="button" data-fridge-delete="${fridge.id}">删除</button>
      </div>
    </article>
  `).join("");
}

function openFridgeManager() {
  renderHomeFridges();
  homeDim.hidden = false;
  openSheet(fridgeManagerSheet);
}

function leaveFridge() {
  closeSheets();
  closeReader();
  closeHomeSetup();
  renderHomeFridges();
  homeScreen.hidden = false;
  window.setTimeout(() => {
    homeScreen.classList.remove("done");
  }, 20);
  showToast("已回到首页");
}

function normalizeInviteCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function renderHomeColorChoices() {
  homeColorGrid.querySelectorAll("[data-color]").forEach((button) => {
    button.classList.toggle("active", button.dataset.color === selectedHomeColor);
  });
}

function openHomeSetup(mode) {
  homeSetupMode = mode;
  const activeMember = window.FridgeStore.getActiveMember();
  selectedHomeColor = activeMember.color || "#a83232";
  homeSetupTitle.textContent = mode === "create" ? "创建冰箱" : "加入冰箱";
  homeInviteLabel.textContent = mode === "create" ? "邀请码（留空自动创建）" : "邀请码";
  homeSetupConfirmButton.textContent = mode === "create" ? "创建并进入" : "加入";
  homeSetupCodeInput.value = "";
  homeFridgeNameField.hidden = mode !== "create";
  homeFridgeNameInput.value = mode === "create" ? "" : "";
  homeSetupNameInput.value = activeMember.name || "";
  renderHomeColorChoices();
  homeDim.hidden = false;
  homeSetupSheet.hidden = false;
  homeSetupSheet.setAttribute("aria-hidden", "false");
  setTimeout(() => homeSetupCodeInput.focus(), 80);
}

function closeHomeSetup() {
  homeDim.hidden = true;
  homeSetupSheet.hidden = true;
  homeSetupSheet.setAttribute("aria-hidden", "true");
}

function submitHomeSetup() {
  const rawCode = homeSetupCodeInput.value.trim();
  const codeInput = normalizeInviteCode(rawCode);
  const fridgeName = homeFridgeNameInput.value.trim();
  const name = homeSetupNameInput.value.trim() || "我";
  let code = null;

  if (homeSetupMode === "create") {
    if (rawCode && codeInput.length !== 8) {
      showToast("邀请码需要 8 位，留空可自动创建");
      return;
    }
    code = window.FridgeStore.createFamily(codeInput, fridgeName);
  } else {
    code = window.FridgeStore.joinFamily(codeInput);
    if (!code) {
      showToast("请输入 8 位邀请码");
      return;
    }
  }

  window.FridgeStore.updateActiveMemberProfile({ name, color: selectedHomeColor });
  closeHomeSetup();
  refresh();
  window.FridgeCloudSync?.syncCurrentFridge();
  showToast(homeSetupMode === "create" ? `新冰箱邀请码：${code}` : `已加入冰箱 ${code}`);
  enterFridge();
}

function currentNote() {
  return window.FridgeStore.getState().notes.find((note) => note.id === activeReaderNoteId);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function openMemoryPage() {
  closeSheets();
  closeReader();
  renderMemoryCalendar();
  memoryPage.classList.add("open");
  memoryPage.setAttribute("aria-hidden", "false");
}

function closeMemoryPage() {
  memoryPage.classList.remove("open");
  memoryPage.setAttribute("aria-hidden", "true");
  closeMemoryDetail();
}

function renderMemoryCalendar() {
  const groups = window.FridgeStore.getFavoriteGroups();
  const year = memoryMonth.getFullYear();
  const month = memoryMonth.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  memoryMonthTitle.textContent = `${year} 年 ${month + 1} 月`;
  for (let i = 0; i < firstWeekday; i += 1) cells.push('<span class="memory-day blank"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(new Date(year, month, day));
    const notes = groups[key] || [];
    const cover = notes.find((note) => note.itemType === "photo" && note.imageData) || notes[0];
    const preview = cover
      ? cover.itemType === "photo" && cover.imageData
        ? `<img src="${escapeHtml(cover.imageData)}" alt="">`
        : `<em>${escapeHtml(String(cover.text || "纪念").slice(0, 18))}</em>`
      : '<small>安静</small>';
    cells.push(`
      <button class="memory-day ${notes.length ? "has-memory" : ""}" type="button" data-memory-date="${key}">
        <strong>${day}</strong>
        <span>${preview}</span>
        ${notes.length ? `<i>${notes.length}</i>` : ""}
      </button>
    `);
  }
  memoryCalendar.innerHTML = cells.join("");
}

function openMemoryDetail(date) {
  const notes = window.FridgeStore.getFavoritesByDate(date);
  memoryDetailDate.textContent = formatDateLabel(date);
  memoryDetailDate.dataset.date = date;
  if (!notes.length) {
    memoryDetailList.innerHTML = `<p class="memory-empty">这一天的冰箱还很安静</p>`;
  } else {
    memoryDetailList.innerHTML = notes.map((note) => {
      const member = window.FridgeStore.getMember(note.authorId);
      const image = note.itemType === "photo" && note.imageData
        ? `<img src="${escapeHtml(note.imageData)}" alt="">`
        : "";
      return `
        <article class="memory-entry ${note.type}">
          ${image ? `<div class="memory-entry-image">${image}</div>` : ""}
          <p>${escapeHtml(note.text || "一张纪念图片贴")}</p>
          <footer>
            <span style="--member-color:${escapeHtml(member.color)}">${escapeHtml(member.name)}</span>
            <time>${new Date(note.time).toLocaleString("zh-CN")}</time>
          </footer>
          <button class="memory-unfavorite" type="button" data-memory-unfavorite="${escapeHtml(note.id)}">取消纪念</button>
        </article>
      `;
    }).join("");
  }
  memoryDetail.classList.add("open");
  memoryDetail.setAttribute("aria-hidden", "false");
}

function closeMemoryDetail() {
  memoryDetail.classList.remove("open");
  memoryDetail.setAttribute("aria-hidden", "true");
}

function setDockActive(activeButton) {
  const buttons = Array.from(document.querySelectorAll(".dock-button"));
  buttons.forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
  const index = Math.max(0, buttons.indexOf(activeButton));
  activeButton.closest(".dock")?.style.setProperty("--dock-index", index);
}

function toggleFavoriteById(noteId, sourceElement) {
  const result = window.FridgeStore.toggleFavorite(noteId);
  if (!result) return;
  if (result.favorite && sourceElement) {
    sourceElement.classList.add("favorite-pop");
    setTimeout(() => sourceElement.classList.remove("favorite-pop"), 360);
  }
  refresh();
  if (activeReaderNoteId === noteId) openReader(noteId);
  if (memoryPage.classList.contains("open")) renderMemoryCalendar();
  showToast(result.favorite ? "已收入冰箱收藏夹" : "已取消纪念收藏");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("input");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function copyFamilyCode() {
  const code = familyCode.textContent.trim();
  if (!code) return;
  try {
    await copyText(code);
    showToast(`邀请码 ${code} 已复制`);
  } catch (error) {
    showToast("复制失败，可以长按邀请码复制");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImageForPhone(file, maxSide = 900, quality = 0.72) {
  if (!file.type.startsWith("image/")) return readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setScrim(open) {
  scrim.hidden = !open;
}

function openSheet(sheet) {
  setScrim(true);
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeSheets() {
  setScrim(false);
  homeDim.hidden = true;
  [composerSheet, memberSheet, fridgeManagerSheet, notificationSheet].forEach((sheet) => {
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
  });
}

function refresh() {
  window.FridgeStore.syncReminderNotifications();
  const state = window.FridgeStore.getState();
  const activeMember = window.FridgeStore.getActiveMember();
  memberInitial.textContent = activeMember.name.slice(0, 1);
  activeFridgeTitle.textContent = state.fridgeName || "小家的冰箱";
  familyCode.textContent = state.familyCode;
  renderHomeFridges();
  window.FridgeRender.renderBoard(board, openReader);
  window.FridgeRender.renderMembers(memberList, activeMember.id, {
    onSelect(memberId) {
      window.FridgeStore.setActiveMember(memberId);
      closeSheets();
      refresh();
      showToast("已经切换家庭成员");
    },
    onLeave(memberId) {
      window.FridgeStore.leaveMember(memberId);
      refresh();
      showToast("已离开家庭，消息会先替你留着");
    },
    onRejoin(memberId) {
      window.FridgeStore.rejoinMember(memberId);
      closeSheets();
      refresh();
      showToast("欢迎回到冰箱");
    }
  });
  updateNotificationDot();
}

function updateNotificationDot() {
  window.FridgeStore.syncReminderNotifications();
  const unread = window.FridgeStore.getVisibleNotifications().some((item) => !item.read);
  notificationDot.hidden = !unread;
}

function setNoteType(type) {
  activeNoteType = type;
  reminderField.hidden = composerMode === "photo" || type !== "reminder";
  noteTextInput.placeholder = placeholders[type] || placeholders.message;
  noteTypeGroup.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === type);
  });
}

function openComposer(type = "message", mode = "note") {
  composerMode = mode;
  selectedPhotoData = null;
  setNoteType(type);
  noteTextInput.value = "";
  reminderInput.value = "";
  composerTitle.textContent = mode === "photo" ? "做一张照片贴" : "贴一张新的";
  contentLabel.textContent = mode === "photo" ? "名字" : "内容";
  noteTextInput.placeholder = mode === "photo" ? "给这张照片贴起个名字..." : placeholders[type];
  noteTypeGroup.hidden = mode === "photo";
  reminderField.hidden = mode === "photo" || type !== "reminder";
  photoUploadButton.hidden = mode !== "photo";
  saveNoteButton.textContent = mode === "photo" ? "贴上照片贴" : "贴到冰箱";
  openSheet(composerSheet);
  setTimeout(() => noteTextInput.focus(), 120);
}

function saveNote() {
  const text = noteTextInput.value.trim();
  if (composerMode === "photo") {
    window.FridgeStore.createPhoto((text || "today").slice(0, 18), selectedPhotoData);
    closeSheets();
    refresh();
    showToast("照片贴也吸住啦");
    return;
  }

  if (!text) {
    showToast("先写一点内容，再贴上去");
    return;
  }

  window.FridgeStore.createNote({
    type: activeNoteType,
    text,
    reminderTime: activeNoteType === "reminder" && reminderInput.value
      ? new Date(reminderInput.value).getTime()
      : null
  });
  closeSheets();
  refresh();
  showToast("已经贴到冰箱上了");
}

function openReader(noteId) {
  const note = window.FridgeStore.getState().notes.find((item) => item.id === noteId);
  if (!note) return;
  activeReaderNoteId = noteId;
  readerLabel.textContent = window.FridgeRender.getNoteLabel(note);
  readerBody.innerHTML = window.FridgeRender.readerMarkup(note);
  commentList.innerHTML = window.FridgeRender.commentsMarkup(note);
  commentInput.value = "";
  preserveButton.textContent = note.preserved ? "取消保鲜" : "保鲜";
  favoriteButton.textContent = note.isFavorite ? "取消纪念" : "收藏纪念";
  reader.classList.add("open");
  reader.setAttribute("aria-hidden", "false");

  readerBody.querySelectorAll("[data-check-index]").forEach((input) => {
    input.addEventListener("change", () => {
      window.FridgeStore.toggleChecklistItem(note.id, input.dataset.checkIndex);
      refresh();
      openReader(note.id);
    });
  });
}

function sendComment() {
  const note = currentNote();
  if (!note) return;
  const text = commentInput.value.trim();
  if (!text) {
    showToast("先写一句留言");
    return;
  }
  window.FridgeStore.addComment(note.id, text);
  openReader(note.id);
  refresh();
  showToast("留言已贴上");
}

function openNotifications() {
  window.FridgeStore.syncReminderNotifications();
  renderNotifications();
  openSheet(notificationSheet);
}

function renderNotifications() {
  notificationList.innerHTML = window.FridgeRender.notificationsMarkup(window.FridgeStore.getVisibleNotifications());
}

function handleNotificationClick(event) {
  const item = event.target.closest("[data-notification-id]");
  if (!item) return;
  window.FridgeStore.markNotificationRead(item.dataset.notificationId);
  closeSheets();
  refresh();
  if (item.dataset.noteId) openReader(item.dataset.noteId);
}

function showMentionMenuFor(input, menu) {
  activeMentionInput = input;
  activeMentionMenu = menu;
  const text = input.value;
  const match = text.match(/(^|\s)@([\u4e00-\u9fa5A-Za-z0-9_]*)$/);
  const shouldShow = Boolean(match);
  if (!shouldShow) {
    menu.hidden = true;
    return;
  }
  const state = window.FridgeStore.getState();
  const keyword = match[2];
  const members = state.members.filter((member) => !keyword || member.name.includes(keyword));
  menu.innerHTML = window.FridgeRender.mentionMenuMarkup(members, state.activeMemberId);
  menu.hidden = !menu.innerHTML.trim();
}

function insertMention(name) {
  if (!activeMentionInput || !activeMentionMenu) return;
  const before = activeMentionInput.value;
  activeMentionInput.value = before.replace(/(^|\s)@[\u4e00-\u9fa5A-Za-z0-9_]*$/, `$1@${name} `);
  activeMentionMenu.hidden = true;
  activeMentionInput.focus();
}

function closeReader() {
  reader.classList.remove("open");
  reader.setAttribute("aria-hidden", "true");
  activeReaderNoteId = null;
}

function togglePreserve() {
  const note = currentNote();
  if (!note) return;
  window.FridgeStore.updateNote(note.id, { preserved: !note.preserved });
  refresh();
  openReader(note.id);
  showToast(note.preserved ? "已经取消保鲜" : "便签已保鲜");
}

function removeCurrentNote() {
  const note = currentNote();
  if (!note) return;
  window.FridgeStore.deleteNote(note.id);
  closeReader();
  refresh();
  showToast("已经从冰箱上撕下来了");
}

function registerEvents() {
  window.addEventListener("fridge-cloud-updated", () => {
    refresh();
    if (activeReaderNoteId) {
      const note = currentNote();
      if (note) openReader(note.id);
      else closeReader();
    }
    showToast("冰箱已同步更新");
  });

  homeCreateButton.addEventListener("click", () => openHomeSetup("create"));
  homeJoinButton.addEventListener("click", () => openHomeSetup("join"));
  homeFridgeManageButton.addEventListener("click", openFridgeManager);
  closeFridgeManagerButton.addEventListener("click", closeSheets);
  fridgeManagerList.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-fridge-open]");
    const deleteButton = event.target.closest("[data-fridge-delete]");

    if (openButton) {
      window.FridgeStore.selectFridge(openButton.dataset.fridgeOpen);
      closeSheets();
      refresh();
      window.FridgeCloudSync?.syncCurrentFridge();
      enterFridge();
      showToast("已打开这个冰箱");
      return;
    }

    if (deleteButton) {
      const card = deleteButton.closest("[data-fridge-id]");
      const name = card?.querySelector("strong")?.textContent || "这个冰箱";
      if (!confirm(`确定删除「${name}」吗？`)) return;
      const result = window.FridgeStore.deleteFridge(deleteButton.dataset.fridgeDelete);
      if (!result.deleted) {
        showToast(result.reason === "last" ? "至少保留一个冰箱" : "没有找到这个冰箱");
        return;
      }
      refresh();
      renderHomeFridges();
      showToast("已删除这个冰箱");
    }
  });
  homeDim.addEventListener("click", () => {
    if (fridgeManagerSheet.classList.contains("open")) {
      closeSheets();
      return;
    }
    closeHomeSetup();
  });
  homeSetupCancelButton.addEventListener("click", closeHomeSetup);
  homeSetupConfirmButton.addEventListener("click", submitHomeSetup);
  homeSetupCodeInput.addEventListener("input", () => {
    homeSetupCodeInput.value = normalizeInviteCode(homeSetupCodeInput.value);
  });
  [homeSetupCodeInput, homeSetupNameInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitHomeSetup();
    });
  });
  homeColorGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (!button) return;
    selectedHomeColor = button.dataset.color;
    renderHomeColorChoices();
  });

  document.querySelector("#addNoteButton").addEventListener("click", (event) => {
    setDockActive(event.currentTarget);
    openComposer("message");
  });
  document.querySelector("#addPhotoButton").addEventListener("click", (event) => {
    setDockActive(event.currentTarget);
    openComposer("message", "photo");
  });
  document.querySelector("#tidyButton").addEventListener("click", (event) => {
    setDockActive(event.currentTarget);
    tidyModeIndex = (tidyModeIndex + 1) % tidyModes.length;
    const mode = tidyModes[tidyModeIndex];
    window.FridgeStore.tidyNotes(mode.value);
    refresh();
    showToast(`整理：${mode.label}`);
  });
  memoryButton.addEventListener("click", (event) => {
    setDockActive(event.currentTarget);
    window.setTimeout(openMemoryPage, 220);
  });
  closeMemoryButton.addEventListener("click", () => {
    closeMemoryPage();
    setDockActive(document.querySelector("#addNoteButton"));
  });
  prevMemoryMonthButton.addEventListener("click", () => {
    memoryMonth = new Date(memoryMonth.getFullYear(), memoryMonth.getMonth() - 1, 1);
    renderMemoryCalendar();
  });
  nextMemoryMonthButton.addEventListener("click", () => {
    memoryMonth = new Date(memoryMonth.getFullYear(), memoryMonth.getMonth() + 1, 1);
    renderMemoryCalendar();
  });
  memoryCalendar.addEventListener("click", (event) => {
    const day = event.target.closest("[data-memory-date]");
    if (!day) return;
    openMemoryDetail(day.dataset.memoryDate);
  });
  memoryDetailList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-memory-unfavorite]");
    if (!button) return;
    const date = memoryDetailDate.dataset.date;
    toggleFavoriteById(button.dataset.memoryUnfavorite);
    renderMemoryCalendar();
    if (date) openMemoryDetail(date);
  });
  closeMemoryDetailButton.addEventListener("click", closeMemoryDetail);

  document.querySelector("#memberButton").addEventListener("click", () => openSheet(memberSheet));
  document.querySelector("#notificationButton").addEventListener("click", openNotifications);
  document.querySelector("#closeComposerButton").addEventListener("click", closeSheets);
  document.querySelector("#closeMemberButton").addEventListener("click", closeSheets);
  closeNotificationButton.addEventListener("click", closeSheets);
  notificationList.addEventListener("click", handleNotificationClick);
  markAllReadButton.addEventListener("click", () => {
    window.FridgeStore.markAllNotificationsRead();
    renderNotifications();
    refresh();
  });
  leaveFridgeButton.addEventListener("click", leaveFridge);
  copyFamilyCodeButton.addEventListener("click", copyFamilyCode);
  document.querySelector("#saveNoteButton").addEventListener("click", saveNote);
  document.querySelector("#closeReaderButton").addEventListener("click", closeReader);
  favoriteButton.addEventListener("click", () => {
    const note = currentNote();
    if (!note) return;
    toggleFavoriteById(note.id, board.querySelector(`[data-id="${note.id}"]`));
  });
  document.querySelector("#preserveButton").addEventListener("click", togglePreserve);
  document.querySelector("#deleteButton").addEventListener("click", removeCurrentNote);
  sendCommentButton.addEventListener("click", sendComment);
  commentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendComment();
  });
  commentInput.addEventListener("input", () => showMentionMenuFor(commentInput, mentionMenu));
  noteTextInput.addEventListener("input", () => showMentionMenuFor(noteTextInput, composerMentionMenu));
  [mentionMenu, composerMentionMenu].forEach((menu) => menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mention-name]");
    if (!button) return;
    insertMention(button.dataset.mentionName);
  }));
  photoUploadButton.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    showToast("正在处理照片...");
    try {
      selectedPhotoData = await resizeImageForPhone(file);
      showToast("照片已选好");
    } catch (error) {
      selectedPhotoData = await readFileAsDataUrl(file);
      showToast("照片已选好");
    } finally {
      photoInput.value = "";
    }
  });

  noteTypeGroup.addEventListener("click", (event) => {
    const button = event.target.closest(".segment");
    if (!button) return;
    setNoteType(button.dataset.type);
  });

  scrim.addEventListener("click", closeSheets);
  reader.addEventListener("click", (event) => {
    if (event.target === reader) closeReader();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSheets();
      closeReader();
      closeMemoryPage();
      mentionMenu.hidden = true;
      composerMentionMenu.hidden = true;
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

registerEvents();
refresh();
registerServiceWorker();

setInterval(updateNotificationDot, 30 * 1000);
