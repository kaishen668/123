// 粘粘 — 简易像素宠物（16x16像素渲染）
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const SCALE = 8; // 16 * 8 = 128 canvas
  const W = 16, H = 16;

  // 基本颜色表（RGBA 或 CSS 颜色）
  const PALETTE = [
    null,
    '#fff6e6', // 1 fur light
    '#ffd89b', // 2 fur mid
    '#b8732f', // 3 fur dark
    '#000',    // 4 outline
    '#ff6b6b', // 5 tongue/cheek
    '#4b4b4b', // 6 eye
    '#7fd3ff', // 7 bowl/water accent
    '#a0d8ff', // 8 bg (unused)
    '#6b8e23', // 9 green (toy)
  ];

  // 一个简单的 16x16 像素猫（数字代表 PALETTE 索引）
  // 你可以替换这个数组生成不同的像素外观
  const SPRITE = [
    0,0,0,4,4,4,4,4,4,4,4,0,0,0,0,0,
    0,0,4,2,2,2,2,2,2,2,2,4,0,0,0,0,
    0,4,2,2,2,2,2,2,2,2,2,2,4,0,0,0,
    4,2,2,1,1,2,2,2,2,1,1,2,2,4,0,0,
    4,2,1,1,1,1,2,2,2,1,1,1,1,2,4,0,
    4,2,1,1,1,1,1,2,2,1,1,1,1,2,4,0,
    4,2,1,1,1,1,1,1,1,1,1,1,1,2,4,0,
    4,2,1,1,1,1,1,1,1,1,1,1,1,2,4,0,
    4,2,2,1,1,1,1,4,4,1,1,1,2,2,4,0,
    0,4,2,2,2,2,2,4,4,2,2,2,2,4,0,0,
    0,0,4,2,2,2,2,4,4,2,2,2,4,0,0,0,
    0,0,0,4,4,4,4,4,4,4,4,4,0,0,0,0,
    0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,
    0,0,0,0,0,4,4,0,0,4,4,0,0,0,0,0,
    0,0,0,0,4,4,0,0,0,0,4,4,0,0,0,0,
    0,0,0,4,4,0,0,0,0,0,0,4,4,0,0,0,
  ];

  // 游戏状态
  let state = {
    hunger: 70,
    thirst: 70,
    happiness: 80,
    energy: 80,
    cleanliness: 90,
    asleep: false,
    lastTick: Date.now(),
    anim: { blink: 0, tail: 0 },
    message: '粘粘醒着！',
  };

  // UI 元素
  const hungerEl = document.getElementById('hunger');
  const thirstEl = document.getElementById('thirst');
  const happinessEl = document.getElementById('happiness');
  const energyEl = document.getElementById('energy');
  const cleanlinessEl = document.getElementById('cleanliness');
  const messageEl = document.getElementById('message');

  // 按钮
  document.getElementById('feedBtn').addEventListener('click', feed);
  document.getElementById('waterBtn').addEventListener('click', water);
  document.getElementById('playBtn').addEventListener('click', play);
  document.getElementById('petBtn').addEventListener('click', pet);
  document.getElementById('cleanBtn').addEventListener('click', clean);
  document.getElementById('sleepBtn').addEventListener('click', toggleSleep);
  document.getElementById('resetBtn').addEventListener('click', resetState);

  // 渲染像素（以 SPRITE 数组为蓝本）
  function drawSprite(frame = 0) {
    // 清空
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 背景渐变（sky）
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0, '#aee3ff');
    g.addColorStop(1, '#8fd1ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 地面
    ctx.fillStyle = '#ffe9b3';
    ctx.fillRect(0, canvas.height - 28, canvas.width, 28);

    // draw pixel sprite scaled
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = SPRITE[y * W + x] || 0;
        if (!idx) continue;
        // 刷新眼睛与尾巴的简单动画
        let color = PALETTE[idx];
        // blink: when anim.blink active, replace eye color with fur or closed eye
        if (idx === 6 && state.anim.blink > 0) {
          color = PALETTE[2]; // blink -> use mid fur to simulate closed eyes
        }
        // tail wag example: shift some pixel indices (here we don't modify SPRITE array, only tint)
        if (state.anim.tail > 0 && x < 5 && y > 7) {
          // slightly darker for tail movement
          if (idx === 2 || idx === 3) color = shadeColor(color, -8);
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }

    // simple bowl
    ctx.fillStyle = '#7fd3ff';
    ctx.fillRect(84, 96, 28, 10);
    ctx.fillStyle = '#fff';
    ctx.fillRect(86, 98, Math.max(0, (state.thirst / 100) * 24), 6);
  }

  // 颜色调节小函数
  function shadeColor(col, percent) {
    // col like #rrggbb
    const num = parseInt(col.slice(1),16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.max(0,Math.min(255,r));
    g = Math.max(0,Math.min(255,g));
    b = Math.max(0,Math.min(255,b));
    return '#' + (r<<16 | g<<8 | b).toString(16).padStart(6,'0');
  }

  // 游戏逻辑：时间流逝、属性衰减
  function tick() {
    const now = Date.now();
    const dt = now - state.lastTick;
    if (dt < 1000/2) return; // limit updates
    const seconds = dt / 1000;
    state.lastTick = now;

    // 如果睡着则恢复能量更快，其他属性衰减慢一点
    const decayMultiplier = state.asleep ? 0.3 : 1;

    // 每秒减少（按比例）
    state.hunger = clamp(state.hunger - 0.5 * decayMultiplier * seconds, 0, 100);
    state.thirst = clamp(state.thirst - 0.6 * decayMultiplier * seconds, 0, 100);
    state.happiness = clamp(state.happiness - 0.2 * seconds, 0, 100);
    state.cleanliness = clamp(state.cleanliness - 0.1 * seconds, 0, 100);
    if (state.asleep) {
      state.energy = clamp(state.energy + 1.8 * seconds, 0, 100);
    } else {
      state.energy = clamp(state.energy - 0.3 * seconds, 0, 100);
    }

    // 危机状态：当饥饿/口渴/低能量时心情降低更快
    if (state.hunger < 20 || state.thirst < 20 || state.energy < 15) {
      state.happiness = clamp(state.happiness - 0.6 * seconds, 0, 100);
      state.message = '粘粘有点不舒服……';
    } else {
      state.message = state.asleep ? '粘粘在睡觉，晚安～' : '粘粘看起来很乖～';
    }

    // 随机小动画触发
    if (Math.random() < 0.02) {
      state.anim.blink = 6; // blink frames
    }
    if (Math.random() < 0.01) {
      state.anim.tail = 10;
    }

    // 动画衰减
    if (state.anim.blink > 0) state.anim.blink--;
    if (state.anim.tail > 0) state.anim.tail--;

    saveState();
    updateUI();
    drawSprite();
  }

  function feed() {
    if (state.asleep) { state.message = '粘粘在睡觉，先别打扰~'; updateUI(); return; }
    state.hunger = clamp(state.hunger + 22, 0, 100);
    state.happiness = clamp(state.happiness + 6, 0, 100);
    state.cleanliness = clamp(state.cleanliness - 2, 0, 100);
    state.anim.tail = 12;
    state.message = '谢谢！粘粘吃得好开心～';
    saveState();
    updateUI();
  }

  function water() {
    if (state.asleep) { state.message = '粘粘在睡觉，先别打扰~'; updateUI(); return; }
    state.thirst = clamp(state.thirst + 26, 0, 100);
    state.happiness = clamp(state.happiness + 4, 0, 100);
    state.message = '喝饱了！';
    saveState();
    updateUI();
  }

  function play() {
    if (state.asleep) { state.message = '粘粘在睡觉，醒来再玩吧~'; updateUI(); return; }
    if (state.energy < 10) {
      state.message = '有点累了，先休息吧。';
    } else {
      state.happiness = clamp(state.happiness + 12, 0, 100);
      state.energy = clamp(state.energy - 12, 0, 100);
      state.hunger = clamp(state.hunger - 6, 0, 100);
      state.thirst = clamp(state.thirst - 6, 0, 100);
      state.anim.tail = 14;
      state.message = '玩得好开心！';
    }
    saveState();
    updateUI();
  }

  function pet() {
    if (state.asleep) {
      state.message = '轻轻摸摸，别惊醒粘粘。';
      return;
    }
    state.happiness = clamp(state.happiness + 8, 0, 100);
    state.message = '呼噜～';
    state.anim.tail = 8;
    saveState();
    updateUI();
  }

  function clean() {
    state.cleanliness = 100;
    state.happiness = clamp(state.happiness + 4, 0, 100);
    state.message = '干净啦！';
    saveState();
    updateUI();
  }

  function toggleSleep() {
    state.asleep = !state.asleep;
    state.message = state.asleep ? '晚安，粘粘在睡觉~' : '醒来了！';
    saveState();
    updateUI();
  }

  function resetState() {
    if (confirm('确认重置存档吗？')) {
      localStorage.removeItem('zhanzi_state_v1');
      state = {
        hunger: 70, thirst: 70, happiness: 80, energy: 80, cleanliness: 90, asleep: false, lastTick: Date.now(), anim:{blink:0,tail:0}, message: '已重置。'
      };
      saveState();
      updateUI();
      drawSprite();
    }
  }

  // UI 更新
  function updateUI() {
    hungerEl.textContent = Math.round(state.hunger);
    thirstEl.textContent = Math.round(state.thirst);
    happinessEl.textContent = Math.round(state.happiness);
    energyEl.textContent = Math.round(state.energy);
    cleanlinessEl.textContent = Math.round(state.cleanliness);
    messageEl.textContent = state.message;
  }

  // 存取档（localStorage）
  function saveState() {
    try {
      const s = JSON.stringify({
        hunger: state.hunger,
        thirst: state.thirst,
        happiness: state.happiness,
        energy: state.energy,
        cleanliness: state.cleanliness,
        asleep: state.asleep,
        lastTick: state.lastTick,
      });
      localStorage.setItem('zhanzi_state_v1', s);
    } catch (e) { /* ignore */ }
  }

  function loadState() {
    try {
      const s = localStorage.getItem('zhanzi_state_v1');
      if (s) {
        const o = JSON.parse(s);
        state.hunger = o.hunger ?? state.hunger;
        state.thirst = o.thirst ?? state.thirst;
        state.happiness = o.happiness ?? state.happiness;
        state.energy = o.energy ?? state.energy;
        state.cleanliness = o.cleanliness ?? state.cleanliness;
        state.asleep = o.asleep ?? state.asleep;
      }
    } catch (e) { /* ignore */ }
  }

  // 工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // 启动
  function init() {
    // 将画布缩放以获得 pixelated 效果
    canvas.style.width = (W * SCALE) + 'px';
    canvas.style.height = (H * SCALE) + 'px';
    // canvas 本身设为 16*8 = 128 像素以获得 pixelated 渲染（已在 HTML 设置）
    ctx.imageSmoothingEnabled = false;

    loadState();
    state.lastTick = Date.now();
    updateUI();
    drawSprite();

    // 主循环：每 500ms 更新一次
    setInterval(tick, 500);
  }

  init();
})();
