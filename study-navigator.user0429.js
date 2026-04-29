// ==UserScript==
// @name         Study-Plus-Navigator
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  自动跳转辅助工具 - 仅供技术研究使用
// @author       YourName
// @match        *://*.sqgj.gov.cn/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const DELAY = 3;
  const POLL_MS = 1000;

  let enabled = true;
  let timer = null;
  let pollTimer = null;
  let triggered = false;
  let triggeredAt = 0;       
  const RESET_COOLDOWN = 15000; 

  // ══ 悬浮按钮 ══════════════════════════════════════════
  const btn = document.createElement('div');
  Object.assign(btn.style, {
    position: 'fixed', bottom: '80px', right: '18px', zIndex: 99999,
    width: '54px', height: '54px', borderRadius: '50%',
    background: '#c00', color: '#fff', fontSize: '11px', fontWeight: 'bold',
    textAlign: 'center', lineHeight: '1.3', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
    cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,.4)',
    userSelect: 'none', transition: 'background .2s',
  });
  btn.title = '点击开启/关闭自动跳转';
  document.body.appendChild(btn);

  function updateBtn() {
    btn.innerHTML = enabled ? '⏭<br>自动<br>跳转' : '⏸<br>已<br>关闭';
    btn.style.background = enabled ? '#c00' : '#888';
  }
  updateBtn();

  btn.addEventListener('click', () => {
    enabled = !enabled;
    updateBtn();
    if (!enabled && timer) { clearInterval(timer); timer = null; hideToast(); }
    showStatus(enabled ? '✅ 自动跳转已开启' : '⏸ 自动跳转已关闭', 2000);
  });

  // ══ Toast提示 ═══════════════════════════════════
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position: 'fixed', bottom: '145px', right: '18px', zIndex: 99998,
    background: 'rgba(0,0,0,.82)', color: '#fff',
    padding: '10px 16px', borderRadius: '8px', fontSize: '13px',
    lineHeight: '1.7', boxShadow: '0 3px 12px rgba(0,0,0,.35)',
    display: 'none', maxWidth: '200px', textAlign: 'center',
  });
  document.body.appendChild(toast);
  function showToast(msg) { toast.innerHTML = msg; toast.style.display = 'block'; }
  function hideToast() { toast.style.display = 'none'; }

  let stTimer = null;
  const stToast = document.createElement('div');
  Object.assign(stToast.style, {
    position: 'fixed', bottom: '145px', right: '18px', zIndex: 99997,
    background: 'rgba(50,50,50,.88)', color: '#fff',
    padding: '8px 14px', borderRadius: '6px', fontSize: '13px', display: 'none',
  });
  document.body.appendChild(stToast);
  function showStatus(msg, ms = 2000) {
    stToast.textContent = msg; stToast.style.display = 'block';
    clearTimeout(stTimer);
    stTimer = setTimeout(() => { stToast.style.display = 'none'; }, ms);
  }

  // ══ 跳转核心逻辑 ════════════════════════════════════════
  function goNext() {
    const items = Array.from(document.querySelectorAll('div.vvitemtitle'));
    if (!items.length) { return; }

    let currentIdx = -1;
    for (let i = 0; i < items.length; i++) {
      const isRed = (el) => {
        const m = window.getComputedStyle(el).color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        return m && +m[1] > 150 && +m[2] < 80 && +m[3] < 80;
      };
      if (isRed(items[i]) || [...items[i].querySelectorAll('*')].some(isRed)) {
        currentIdx = i; break;
      }
    }

    if (currentIdx === -1) {
      let name = '';
      document.querySelectorAll('*').forEach(el => {
        if (!el.children.length && /正在学习/.test(el.textContent))
          name = el.textContent.replace(/正在学习[：:]\s*/, '').trim();
      });
      if (name) currentIdx = items.findIndex(el => el.textContent.trim().includes(name));
    }

    if (currentIdx === -1 || currentIdx >= items.length - 1) return;
    items[currentIdx + 1].click();
  }

  function startCountdown(reason) {
    if (!enabled || triggered) return;
    triggered = true;
    triggeredAt = Date.now();
    let r = DELAY;
    showToast(`✅ ${reason}<br>⏭ <b>${r}</b> 秒后跳转下一节`);
    timer = setInterval(() => {
      r--;
      if (r <= 0) {
        clearInterval(timer); timer = null;
        hideToast();
        goNext();
      } else {
        showToast(`✅ ${reason}<br>⏭ <b>${r}</b> 秒后跳转下一节`);
      }
    }, 1000);
  }

  function attachVideo(video) {
    if (video.__v6bound) return;
    video.__v6bound = true;
    video.addEventListener('ended', () => startCountdown('视频播放完毕'));
  }

  function checkProgress() {
    if (triggered) return;
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length) continue;
      const t = el.textContent || '';
      if (/学习进度[：:]\s*100\s*%/.test(t) || /进度[：:]\s*100\s*%/.test(t)) {
        startCountdown('学习进度 100%');
        return;
      }
    }
  }

  function scan() { document.querySelectorAll('video').forEach(attachVideo); }
  scan();
  pollTimer = setInterval(checkProgress, POLL_MS);

  new MutationObserver(() => {
    scan();
    const now = Date.now();
    if (triggered && (now - triggeredAt) < RESET_COOLDOWN) return;
    if (timer) { clearInterval(timer); timer = null; hideToast(); }
    triggered = false;
  }).observe(document.body, { childList: true, subtree: true });
})();