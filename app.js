const STORAGE_KEYS = {
  webhookUrl: "remotePcControl.webhookUrl",
  remoteUrl: "remotePcControl.remoteUrl",
  bootDelay: "remotePcControl.bootDelay",
  webhookMode: "remotePcControl.webhookMode",
};

const DEFAULT_REMOTE_URL = "https://remotedesktop.google.com/access";
const DEFAULT_BOOT_DELAY = 60;
const DEFAULT_WEBHOOK_MODE = "direct_tab";

const $ = (id) => document.getElementById(id);

const elements = {
  settingsBtn: $("settingsBtn"),
  closeSettingsBtn: $("closeSettingsBtn"),
  settingsDialog: $("settingsDialog"),
  webhookInput: $("webhookInput"),
  remoteUrlInput: $("remoteUrlInput"),
  bootDelayInput: $("bootDelayInput"),
  webhookModeInput: $("webhookModeInput"),
  saveSettingsBtn: $("saveSettingsBtn"),
  clearSettingsBtn: $("clearSettingsBtn"),
  powerOnBtn: $("powerOnBtn"),
  remoteBtn: $("remoteBtn"),
  testWebhookBtn: $("testWebhookBtn"),
  copyGuideBtn: $("copyGuideBtn"),
  configStatus: $("configStatus"),
  statusDot: $("statusDot"),
  lastResult: $("lastResult"),
  countdownCard: $("countdownCard"),
  countdownNumber: $("countdownNumber"),
  progressBar: $("progressBar"),
  toast: $("toast"),
};

let countdownTimer = null;

function getSettings() {
  return {
    webhookUrl: localStorage.getItem(STORAGE_KEYS.webhookUrl) || "",
    remoteUrl: localStorage.getItem(STORAGE_KEYS.remoteUrl) || DEFAULT_REMOTE_URL,
    bootDelay: Number(localStorage.getItem(STORAGE_KEYS.bootDelay)) || DEFAULT_BOOT_DELAY,
    webhookMode: localStorage.getItem(STORAGE_KEYS.webhookMode) || DEFAULT_WEBHOOK_MODE,
  };
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.webhookUrl, settings.webhookUrl.trim());
  localStorage.setItem(STORAGE_KEYS.remoteUrl, settings.remoteUrl.trim() || DEFAULT_REMOTE_URL);
  localStorage.setItem(STORAGE_KEYS.bootDelay, String(settings.bootDelay || DEFAULT_BOOT_DELAY));
  localStorage.setItem(STORAGE_KEYS.webhookMode, settings.webhookMode || DEFAULT_WEBHOOK_MODE);
}

function clearSettings() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

function updateStatus() {
  const settings = getSettings();
  const hasWebhook = Boolean(settings.webhookUrl);

  elements.configStatus.textContent = hasWebhook ? "준비 완료" : "웹훅 설정 필요";
  elements.statusDot.className = `status-dot ${hasWebhook ? "ready" : "waiting"}`;
  elements.lastResult.textContent = hasWebhook
    ? "PC 켜기 버튼을 누르면 S21의 MacroDroid 웹훅이 실행됩니다."
    : "오른쪽 위 설정에서 MacroDroid 웹훅 URL을 먼저 저장하세요.";
}

function showToast(message, duration = 2600) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, duration);
}

function openSettings() {
  const settings = getSettings();

  elements.webhookInput.value = settings.webhookUrl;
  elements.remoteUrlInput.value = settings.remoteUrl;
  elements.bootDelayInput.value = String(settings.bootDelay);
  if (elements.webhookModeInput) {
    elements.webhookModeInput.value = settings.webhookMode;
  }

  if (typeof elements.settingsDialog.showModal === "function") {
    elements.settingsDialog.showModal();
  } else {
    elements.settingsDialog.setAttribute("open", "open");
  }
}

function closeSettings() {
  elements.settingsDialog.close();
}

function normalizeUrl(url) {
  const trimmed = url.trim();

  if (!trimmed) return "";

  try {
    return new URL(trimmed).toString();
  } catch {
    throw new Error("URL 형식이 올바르지 않습니다.");
  }
}

function openWebhookInNewTab(url) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function fireWebhookInBackground(url) {
  // 1) iframe 방식
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    iframe.remove();
  }, 10000);

  // 2) 이미지 요청 방식. 응답이 이미지가 아니어도 GET 요청 자체는 나갑니다.
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;

  // 3) fetch no-cors 보조 시도
  fetch(url, {
    method: "GET",
    mode: "no-cors",
    cache: "no-store",
  }).catch(() => {});
}

async function fireWebhook(url, mode) {
  const targetUrl = normalizeUrl(url);

  if (mode === "background") {
    fireWebhookInBackground(targetUrl);
    return;
  }

  // MacroDroid 웹훅은 일부 환경에서 fetch/no-cors나 iframe으로는 안 먹고
  // 브라우저 주소창에서 직접 열었을 때만 확실히 트리거되는 경우가 있습니다.
  // 그래서 기본값은 새 탭으로 실제 URL을 여는 방식입니다.
  openWebhookInNewTab(targetUrl);
}

function startCountdown(seconds) {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }

  let remaining = Number(seconds) || DEFAULT_BOOT_DELAY;
  const total = remaining;

  elements.countdownCard.classList.remove("hidden");
  elements.countdownNumber.textContent = String(remaining);
  elements.progressBar.style.width = "0%";

  countdownTimer = window.setInterval(() => {
    remaining -= 1;

    const progress = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
    elements.countdownNumber.textContent = String(Math.max(remaining, 0));
    elements.progressBar.style.width = `${progress}%`;

    if (remaining <= 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
      elements.progressBar.style.width = "100%";
      showToast("부팅 대기 완료. 원격 접속을 눌러보세요.", 3500);
    }
  }, 1000);
}

async function handlePowerOn() {
  const settings = getSettings();

  if (!settings.webhookUrl) {
    showToast("먼저 설정에서 MacroDroid 웹훅 URL을 저장하세요.");
    openSettings();
    return;
  }

  elements.powerOnBtn.disabled = true;

  try {
    await fireWebhook(settings.webhookUrl, settings.webhookMode);

    const time = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const modeText = settings.webhookMode === "background"
      ? "앱 내부 실행"
      : "새 탭 실행";

    elements.lastResult.textContent = `${time} PC 켜기 요청을 보냈습니다. 실행 방식: ${modeText}`;
    showToast("PC 켜기 요청을 보냈습니다.");
    startCountdown(settings.bootDelay);
  } catch (error) {
    elements.lastResult.textContent = error.message;
    elements.statusDot.className = "status-dot error";
    showToast(error.message);
  } finally {
    window.setTimeout(() => {
      elements.powerOnBtn.disabled = false;
    }, 1200);
  }
}

function handleRemoteOpen() {
  const settings = getSettings();
  const remoteUrl = settings.remoteUrl || DEFAULT_REMOTE_URL;

  try {
    const url = normalizeUrl(remoteUrl);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error.message);
  }
}

function showGuide() {
  const guide = [
    "1. S21은 집 와이파이와 충전기에 연결",
    "2. S24에서 PC 켜기 버튼 실행",
    "3. 30~60초 대기",
    "4. 원격 접속 버튼 실행",
    "5. Chrome 원격 데스크톱 PIN 입력",
  ].join("\n");

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(guide).then(() => {
      showToast("사용 순서를 클립보드에 복사했습니다.");
    }).catch(() => {
      alert(guide);
    });
  } else {
    alert(guide);
  }
}

function bindEvents() {
  elements.settingsBtn.addEventListener("click", openSettings);
  elements.closeSettingsBtn.addEventListener("click", closeSettings);

  elements.saveSettingsBtn.addEventListener("click", () => {
    try {
      const settings = {
        webhookUrl: normalizeUrl(elements.webhookInput.value),
        remoteUrl: normalizeUrl(elements.remoteUrlInput.value || DEFAULT_REMOTE_URL),
        bootDelay: Number(elements.bootDelayInput.value) || DEFAULT_BOOT_DELAY,
        webhookMode: elements.webhookModeInput?.value || DEFAULT_WEBHOOK_MODE,
      };

      saveSettings(settings);
      updateStatus();
      closeSettings();
      showToast("설정을 저장했습니다.");
    } catch (error) {
      showToast(error.message);
    }
  });

  elements.clearSettingsBtn.addEventListener("click", () => {
    if (!confirm("저장된 웹훅 URL과 설정을 초기화할까요?")) return;

    clearSettings();
    updateStatus();
    closeSettings();
    showToast("설정을 초기화했습니다.");
  });

  elements.powerOnBtn.addEventListener("click", handlePowerOn);
  elements.testWebhookBtn.addEventListener("click", handlePowerOn);
  elements.remoteBtn.addEventListener("click", handleRemoteOpen);
  elements.copyGuideBtn.addEventListener("click", showGuide);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // 서비스워커 등록 실패는 앱 사용 자체를 막지 않습니다.
  }
}

function init() {
  bindEvents();
  updateStatus();
  registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", init);
