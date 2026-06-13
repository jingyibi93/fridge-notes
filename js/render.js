const noteLabels = {
  message: "日常留言",
  shopping: "购物清单",
  reminder: "提醒事项",
  photo: "图片冰箱贴"
};

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

const renderMagnetAssets = MAGNET_ASSET_PATHS;

const oldPins = new Set(["✦", "♡", "✿", "✓", "☎", "🍅", "🍓", "🥐", "🥨", "🍞", "🥖", "🥝", "🍩", "☕", "🥛", "🧈", "🍳", "🌶️", "🧄", "🍎"]);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dayDiff(time) {
  const then = new Date(time);
  const today = new Date();
  const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((todayDay - thenDay) / 86400000);
}

function fadeStyle(note) {
  if (note.preserved) return { opacity: 1, saturate: 1 };
  const days = dayDiff(note.time);
  if (days <= 0) return { opacity: 1, saturate: 1 };
  return {
    opacity: Math.max(0.18, 1 - days * 0.12),
    saturate: Math.max(0, 1 - days * 0.2)
  };
}

function noteProgress(note) {
  if (note.type !== "shopping") return "";
  const items = note.text.split("\n").filter(Boolean);
  const done = items.filter((_, index) => note.checkedItems?.[index]).length;
  return `<span class="note-progress">✓ ${done}/${items.length}</span>`;
}

function cardTime(time) {
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function magnetFor(note) {
  const raw = note.pin || note.emoji;
  if (raw && renderMagnetAssets.includes(String(raw))) return raw;
  if (raw && String(raw).startsWith("assets/magnets/")) {
    const seed = String(note.id || raw).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return renderMagnetAssets[seed % renderMagnetAssets.length];
  }
  if (raw && !oldPins.has(raw)) return raw;
  const seed = String(note.id || note.text || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return renderMagnetAssets[seed % renderMagnetAssets.length];
}

function magnetMarkup(note) {
  const src = magnetFor(note);
  return `<span class="cute-magnet"><img src="${escapeHtml(src)}" alt=""></span>`;
}

function commentBadge(note) {
  const count = (note.comments || []).length;
  if (!count) return '<span class="note-comment-placeholder"></span>';
  return `<span class="note-comment-badge">☁ ${count}</span>`;
}

function cardFooterMarkup(note, member) {
  const status = note.type === "shopping"
    ? noteProgress(note)
    : note.preserved ? '<span class="preserved-badge">冰鲜</span>' : '<span></span>';
  return `
    <div class="note-footer">
      <div class="note-status-row">
        ${commentBadge(note)}
        ${status}
      </div>
      <div class="note-author-row">
        <span class="note-author">${escapeHtml(member.name)}</span>
        <time class="note-time">${cardTime(note.time)}</time>
      </div>
    </div>
  `;
}

function hasMoreContent(note) {
  if (note.type === "shopping") {
    return note.text.split("\n").filter(Boolean).length > 2;
  }
  return String(note.text || "").replace(/\s/g, "").length > 22 || String(note.text || "").includes("\n");
}

function notePreviewMarkup(note) {
  const moreClass = hasMoreContent(note) ? " has-more" : "";
  if (note.type === "shopping") {
    const items = note.text.split("\n").filter(Boolean);
    return `
      <div class="note-preview note-checklist-preview${moreClass}">
        ${items.map((item, index) => `
          <div class="preview-check-item ${note.checkedItems?.[index] ? "checked" : ""}">
            <i></i>
            <span>${escapeHtml(item)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }
  return `<p class="note-preview note-text${moreClass}">${escapeHtml(note.text)}</p>`;
}

function buildNoteCard(note) {
  const member = window.FridgeStore.getMember(note.authorId);
  const fade = fadeStyle(note);
  const element = document.createElement("article");
  element.className = `magnet note-card ${note.type}`;
  element.dataset.id = note.id;
  element.style.setProperty("--x", note.x);
  element.style.setProperty("--y", note.y);
  element.style.setProperty("--z", note.z);
  element.style.setProperty("--r", `${note.rotate || 0}deg`);
  element.style.setProperty("--w", `${note.width || 122}px`);
  element.style.setProperty("--op", fade.opacity);
  element.style.setProperty("--sat", fade.saturate);
  element.innerHTML = `
    ${magnetMarkup(note)}
    <h3 class="note-title">${noteLabels[note.type]}</h3>
    ${notePreviewMarkup(note)}
    ${cardFooterMarkup(note, member)}
  `;
  return element;
}

function buildPhotoCard(note) {
  const member = window.FridgeStore.getMember(note.authorId);
  const fade = fadeStyle(note);
  const element = document.createElement("article");
  element.className = "magnet photo-card";
  element.dataset.id = note.id;
  element.style.setProperty("--x", note.x);
  element.style.setProperty("--y", note.y);
  element.style.setProperty("--z", note.z);
  element.style.setProperty("--r", `${note.rotate || 0}deg`);
  element.style.setProperty("--w", `${note.width || 92}px`);
  element.style.setProperty("--op", fade.opacity);
  element.style.setProperty("--sat", fade.saturate);
  element.style.setProperty("--art", note.art);
  const image = note.imageData
    ? `<img src="${escapeHtml(note.imageData)}" alt="${escapeHtml(note.text || "照片贴")}">`
    : `<img class="photo-placeholder-magnet" src="${escapeHtml(magnetFor(note))}" alt="">`;
  element.innerHTML = `
    ${magnetMarkup(note)}
    <div class="photo-art">${image}</div>
    <div class="photo-caption">${escapeHtml(note.text || "memory")}</div>
    ${cardFooterMarkup(note, member)}
  `;
  return element;
}

function renderBoard(board, onOpen) {
  const { notes } = window.FridgeStore.getState();
  board.innerHTML = "";
  notes.forEach((note) => {
    const element = note.itemType === "photo" ? buildPhotoCard(note) : buildNoteCard(note);
    window.FridgeDrag.attachDrag(element, note, board, onOpen);
    board.appendChild(element);
  });
}

function renderMembers(container, activeMemberId, handlers) {
  const { members } = window.FridgeStore.getState();
  container.innerHTML = "";
  members.forEach((member) => {
    const row = document.createElement("div");
    row.className = `member-item ${member.id === activeMemberId ? "active" : ""} ${member.left ? "left" : ""}`;
    row.style.setProperty("--member-color", member.color);
    const status = member.left ? "（已离开）" : "";
    const primaryLabel = member.left ? "回到冰箱" : member.id === activeMemberId ? "当前" : "切换";
    const leaveButton = !member.left && member.id === activeMemberId
      ? `<button type="button" data-member-leave="${member.id}">离开</button>`
      : "";
    row.innerHTML = `
      <i class="member-swatch"></i>
      <strong>${escapeHtml(member.name)}${status}</strong>
      <div class="member-actions">
        <button type="button" data-member-select="${member.id}">${primaryLabel}</button>
        ${leaveButton}
      </div>
    `;
    row.querySelector("[data-member-select]").addEventListener("click", () => {
      if (member.left) handlers.onRejoin(member.id);
      else handlers.onSelect(member.id);
    });
    const leave = row.querySelector("[data-member-leave]");
    if (leave) leave.addEventListener("click", () => handlers.onLeave(member.id));
    container.appendChild(row);
  });
}

function readerMarkup(note) {
  const member = window.FridgeStore.getMember(note.authorId);
  if (note.type === "shopping") {
    const items = note.text.split("\n").filter(Boolean);
    return `
      <div class="reader-checklist">
        ${items.map((item, index) => `
          <label>
            <input type="checkbox" data-check-index="${index}" ${note.checkedItems?.[index] ? "checked" : ""}>
            <span>${escapeHtml(item)}</span>
          </label>
        `).join("")}
      </div>
      <p class="reader-meta">${escapeHtml(member.name)} · ${new Date(note.time).toLocaleString("zh-CN")}</p>
    `;
  }

  if (note.itemType === "photo") {
    const image = note.imageData
      ? `<img src="${escapeHtml(note.imageData)}" alt="${escapeHtml(note.text || "照片贴")}">`
      : escapeHtml(note.emoji || "✦");
    return `
      <div class="photo-art reader-photo-art" style="--art:${note.art}">${image}</div>
      <p class="reader-text">${escapeHtml(note.text || "一张照片贴")}</p>
      <p class="reader-meta">${escapeHtml(member.name)} · ${new Date(note.time).toLocaleString("zh-CN")}</p>
    `;
  }

  const reminder = note.reminderTime
    ? `<br>提醒：${new Date(note.reminderTime).toLocaleString("zh-CN")}`
    : "";
  return `
    <p class="reader-text">${escapeHtml(note.text)}</p>
    <p class="reader-meta">${escapeHtml(member.name)} · ${new Date(note.time).toLocaleString("zh-CN")}${reminder}</p>
  `;
}

function getNoteLabel(note) {
  return noteLabels[note.type] || "便签";
}

function commentsMarkup(note) {
  const comments = note.comments || [];
  if (!comments.length) {
    return `<p class="empty-comments">还没有留言，先写一句吧。</p>`;
  }
  return comments.map((comment) => {
    const member = window.FridgeStore.getMember(comment.authorId);
    return `
      <article class="comment-item">
        <i style="--member-color:${member.color}"></i>
        <div>
          <strong>${escapeHtml(member.name)}</strong>
          <p>${escapeHtml(comment.text)}</p>
        </div>
      </article>
    `;
  }).join("");
}

function notificationsMarkup(notifications) {
  if (!notifications.length) {
    return `<p class="empty-comments">暂时没有新的通知。</p>`;
  }
  return notifications.map((item) => `
    <article class="notification-item ${item.read ? "" : "unread"}" data-notification-id="${item.id}" data-note-id="${item.noteId || ""}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.body || "")}</p>
      <span>${notificationTypeLabel(item.type)}</span>
    </article>
  `).join("");
}

function notificationTypeLabel(type) {
  if (type === "mention") return "@提及";
  if (type === "comment") return "评论";
  if (type === "reminder") return "提醒";
  return "通知";
}

function mentionMenuMarkup(members, activeMemberId) {
  return members
    .filter((member) => member.id !== activeMemberId)
    .map((member) => `
      <button type="button" data-mention-id="${member.id}" data-mention-name="${escapeHtml(member.name)}">
        <i style="--member-color:${member.color}"></i>
        <span>@${escapeHtml(member.name)}${member.left ? "（已离开）" : ""}</span>
      </button>
    `).join("");
}

window.FridgeRender = {
  renderBoard,
  renderMembers,
  readerMarkup,
  commentsMarkup,
  notificationsMarkup,
  mentionMenuMarkup,
  getNoteLabel
};
