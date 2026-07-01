const STORAGE_KEYS = {
  webhookUrl: "remotePcControl.webhookUrl",
  remoteUrl: "remotePcControl.remoteUrl",
  bootDelay: "remotePcControl.bootDelay",
};

const DEFAULT_REMOTE_URL = "https://remotedesktop.google.com/access";
const DEFAULT_BOOT_DELAY = 60;

const $ = (id) => document.getElementById(id);

const elements = {
  settingsBtn: $("settingsBtn"),
  closeSettingsBtn: $("closeSettingsBtn"),
  settingsDialog: $("settingsDialog"),
  webhookInput: $("webhookInput"),
  remoteUrlInput: $("remoteUrlInput"),
  bootDelayInput: $("bootDelayInput"),
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
  };
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.webhookUrl, settings.webhookUrl.trim());
  localStorage.setItem(STORAGE_KEYS.remoteUrl, settings.remoteUrl.trim() || DEFAULT_REMOTE_URL);
  localStorage.setItem(STORAGE_KEYS.bootDelay, String(settings.bootDelay || DEFAULT_BOOT_DELAY));
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

/**
 * MacroDroid Webhook은 외부 도메인이라 CORS 응답을 안 줄 수 있습니다.
 * 그래서 fetch 결과를 읽지 않고 mode:no-cors로 요청만 보냅니다.
 * 브라우저 정책상 성공/실패를 정확히 알 수 없으므로, 앱에서는 “요청 보냄”으로 처리합니다.
 */
async function fireWebhook(url) {
  const targetUrl = normalizeUrl(url);

  try {
    await fetch(targetUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
    });
  } catch {
    // no-cors 환경에서도 일부 브라우저는 네트워크 예외를 던질 수 있어서
    // iframe fallback을 한 번 더 사용합니다.
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = targetUrl;
    document.body.appendChild(iframe);

    window.setTimeout(() => {
      iframe.remove();
    }, 8000);
  }
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
    await fireWebhook(settings.webhookUrl);

    const time = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    elements.lastResult.textContent = `${time} PC 켜기 요청을 보냈습니다. S21 MacroDroid 실행 여부를 확인하세요.`;
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
