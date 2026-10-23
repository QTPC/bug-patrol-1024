import { BUGS, bugById, SOOTHE_ACTIONS, SPRITES } from '../data/bugs';
import { PHASES } from '../data/map';
import type { BugDef, Quality, SootheAction, ZoneId } from '../data/types';
import type { ProgressStore } from '../state/ProgressStore';
import type { OfficeScene } from '../game/OfficeScene';

type ToastTone = 'info' | 'ok' | 'warn' | 'tame' | 'bad' | 'tip';

interface CaptureOptions {
  name: string;
  color: string;
  duration: number;
  green: [number, number];
  amber: [number, number];
}

const $id = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function lighten(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function bugSVG(def: BugDef): string {
  const rows = SPRITES[def.sprite];
  let rects = '';
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let fill = def.color;
      if (ch === 'o') fill = '#f4fff9';
      else if (ch === 'x') fill = '#06110b';
      else if (ch === '%') fill = lighten(def.color, 0.38);
      rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    }
  }
  return `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export class GameUI {
  private scene?: OfficeScene;
  private store?: ProgressStore;
  private storeSub: (() => void) | null = null;
  private wired = false;
  private touchMode = false;

  private boot = $id<HTMLDivElement>('boot');
  private gameFrame = $id<HTMLElement>('gameFrame');
  private hudCaught = $id<HTMLElement>('hudCaught');
  private hudTamed = $id<HTMLElement>('hudTamed');
  private goalChip = $id<HTMLElement>('goalChip');
  private journalCount = $id<HTMLElement>('journalCount');
  private zoneName = $id<HTMLElement>('zoneName');
  private zoneEn = $id<HTMLElement>('zoneEn');
  private mmZone = $id<HTMLElement>('mmZone');
  private shiftClock = $id<HTMLElement>('shiftClock');
  private shiftPhase = $id<HTMLElement>('shiftPhase');
  private interactionPrompt = $id<HTMLElement>('interactionPrompt');
  private toastEl = $id<HTMLDivElement>('toast');
  private journalBtn = $id<HTMLButtonElement>('btnJournal');
  private soundBtn = $id<HTMLButtonElement>('btnSound');
  private perkBar = $id<HTMLDivElement>('perkBar');
  private splitTimer = $id<HTMLDivElement>('splitTimer');

  private captureBar = $id<HTMLDivElement>('captureBar');
  private captureName = $id<HTMLElement>('captureName');
  private captureMarker = $id<HTMLElement>('captureMarker');
  private captureGreen = $id<HTMLElement>('captureGreen');
  private captureAmber = $id<HTMLElement>('captureAmber');
  private captureTrack = $id<HTMLElement>('captureTrack');

  private journal = $id<HTMLDivElement>('journal');
  private journalGrid = $id<HTMLDivElement>('journalGrid');
  private detail = $id<HTMLDivElement>('detail');
  private detailPanel = $id<HTMLDivElement>('detailPanel');
  private ending = $id<HTMLDivElement>('ending');
  private endingStats = $id<HTMLDivElement>('endingStats');

  private mmPlayer: SVGCircleElement | null = null;
  private mmBugs: SVGGElement | null = null;

  private toastTimer = 0;
  private minimapTimer = 0;
  private endingTimer = 0;

  private captureActive = false;
  private captureStart = 0;
  private captureDuration = 1200;
  private captureRAF = 0;
  private captureResult: ((position: number) => void) | null = null;
  private captureTimeout: (() => void) | null = null;

  private detailId: string | null = null;
  private detailReaction = '';
  private qUsed = false;
  private endingShown = false;
  private keyBuffer = '';

  constructor() {
    this.mmPlayer = document.querySelector<SVGCircleElement>('#mmPlayer');
    this.mmBugs = document.querySelector<SVGGElement>('#mmBugs');
    this.wire();
  }

  bind(scene: OfficeScene, store: ProgressStore): void {
    this.scene = scene;
    this.store = store;

    this.storeSub?.();
    this.storeSub = store.onChange(() => this.onStoreChange());

    this.renderHUD();
    this.renderPerks();
    this.renderJournal();
    this.setShift(0);
    this.setSoundMuted(scene.isMuted());
    this.renderMinimap();
    window.clearInterval(this.minimapTimer);
    this.minimapTimer = window.setInterval(() => this.renderMinimap(), 120);
    this.setupTouch();
    window.setTimeout(() => this.ready(), 3500);
    if (store.allTamed()) window.setTimeout(() => this.checkEnding(true), 900);
  }

  ready(): void {
    this.boot?.classList.add('hide');
  }

  private wire(): void {
    if (this.wired) return;
    this.wired = true;

    this.soundBtn?.addEventListener('click', () => {
      this.soundBtn?.blur();
      this.scene?.toggleSound();
    });

    this.journalBtn?.addEventListener('click', () => {
      this.journalBtn?.blur();
      this.openJournal();
    });

    $id<HTMLButtonElement>('btnJournalClose')?.addEventListener('click', () => this.closeJournal());
    $id<HTMLButtonElement>('btnContinue')?.addEventListener('click', () => this.closeEnding());
    $id<HTMLButtonElement>('btnNewShift')?.addEventListener('click', () => this.resetAll());
    $id<HTMLButtonElement>('btnReset')?.addEventListener('click', () => this.resetAll());

    this.journal?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.close === 'journal') {
        this.closeJournal();
        return;
      }
      const card = target.closest<HTMLElement>('.journal-card');
      if (!card?.dataset.id) return;
      if (this.store?.isCaught(card.dataset.id)) this.openDetail(card.dataset.id);
      else this.toast('这份档案还没解锁 · 先去收容它', 'tip');
    });

    this.detail?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.close === 'detail') {
        this.hideDetail();
        return;
      }
      if (target.closest('[data-close-detail]')) {
        this.hideDetail();
        return;
      }
      const action = target.closest<HTMLElement>('[data-act]');
      if (action?.dataset.act) this.applySoothe(action.dataset.act as SootheAction);
    });

    this.perkBar?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('#perkQ')) {
        this.blurActive();
        this.scene?.handleAbility();
      }
    });

    this.captureTrack?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.resolveCaptureNow();
    });

    window.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  private onKeyDown(event: KeyboardEvent): void {
    const overlay = this.isOverlayOpen();

    if (event.key === 'Tab') {
      if (this.journalOpen()) return; // let focus move inside the journal
      if (this.endingOpen()) return;
      if (this.captureActive) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      this.openJournal();
      return;
    }

    if (event.key === 'Escape') {
      if (this.detailOpen()) {
        this.hideDetail();
        return;
      }
      if (this.journalOpen()) {
        this.closeJournal();
        return;
      }
      if (this.endingOpen()) this.closeEnding();
      return;
    }

    if (event.code === 'Space') {
      if (event.repeat) return;
      if (this.captureActive) {
        event.preventDefault();
        this.resolveCaptureNow();
        return;
      }
      if (overlay) return;
      event.preventDefault();
      this.scene?.handleNet();
      return;
    }

    if (!overlay && !this.captureActive && event.key.length === 1 && /[0-9]/.test(event.key)) {
      this.keyBuffer = (this.keyBuffer + event.key).slice(-4);
      if (this.keyBuffer === '1024') {
        this.keyBuffer = '';
        this.scene?.celebrate();
      }
    }
  }

  setZone(zone: { name: string; en: string; id: ZoneId }): void {
    if (this.zoneName) this.zoneName.textContent = zone.name;
    if (this.zoneEn) this.zoneEn.textContent = zone.en;
    if (this.mmZone) this.mmZone.textContent = zone.id.toUpperCase();
  }

  setShift(index: number): void {
    const phase = PHASES[Math.max(0, Math.min(PHASES.length - 1, index))];
    if (this.shiftClock) this.shiftClock.textContent = phase.clock;
    if (this.shiftPhase) this.shiftPhase.textContent = phase.label;
  }

  setInteraction(text: string): void {
    if (!this.interactionPrompt) return;
    if (!text) {
      this.interactionPrompt.classList.remove('show');
      this.interactionPrompt.textContent = '';
      return;
    }
    const split = text.indexOf(' · ');
    if (split > -1) {
      this.interactionPrompt.innerHTML = `<b>${text.slice(0, split)}</b> · ${text.slice(split + 3)}`;
    } else {
      this.interactionPrompt.textContent = text;
    }
    this.interactionPrompt.classList.add('show');
  }

  toast(message: string, tone: ToastTone = 'info'): void {
    if (!this.toastEl) return;
    const codes: Record<ToastTone, string> = {
      info: '[INFO]',
      ok: '[OK]',
      warn: '[WARN]',
      tame: '[TAMED]',
      bad: '[MISS]',
      tip: '[TIP]',
    };
    this.toastEl.dataset.code = codes[tone];
    this.toastEl.dataset.tone = tone;
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl?.classList.remove('show'), 2700);
  }

  setSoundMuted(muted: boolean): void {
    if (!this.soundBtn) return;
    this.soundBtn.textContent = muted ? 'SND OFF' : 'SND ON';
    this.soundBtn.setAttribute('aria-pressed', String(!muted));
  }

  setQUsed(used: boolean): void {
    this.qUsed = used;
    this.renderPerks();
  }

  setSplitTimer(remaining: number | null): void {
    if (!this.splitTimer) return;
    if (remaining == null) {
      this.splitTimer.classList.remove('show');
      this.splitTimer.setAttribute('aria-hidden', 'true');
      return;
    }
    this.splitTimer.classList.add('show');
    this.splitTimer.setAttribute('aria-hidden', 'false');
    const value = this.splitTimer.querySelector('b');
    if (value) value.textContent = `${Math.max(0, remaining).toFixed(1)}s`;
  }

  private renderHUD(): void {
    if (!this.store) return;
    const caught = this.store.caughtCount();
    const tamed = this.store.tamedCount();
    if (this.hudCaught) this.hudCaught.textContent = `${caught}/${BUGS.length}`;
    if (this.hudTamed) this.hudTamed.textContent = `${tamed}/${BUGS.length}`;
    if (this.goalChip) {
      this.goalChip.innerHTML = `<span>GOAL</span><b>收容 ${caught}/${BUGS.length} · 驯化 ${tamed}/${BUGS.length}</b>`;
    }
    if (this.journalCount) {
      this.journalCount.textContent = `${caught} / ${BUGS.length} 已收容 · ${tamed} 已驯化`;
    }
    this.journalBtn?.classList.toggle('attention', caught > tamed);
  }

  private renderPerks(): void {
    if (!this.perkBar || !this.store) return;
    if (!this.store.perkUnlocked('scope')) {
      this.perkBar.innerHTML = '';
      return;
    }
    this.perkBar.innerHTML = `<button class="perk-chip${this.qUsed ? ' used' : ''}" id="perkQ" type="button" ${this.qUsed ? 'disabled' : ''}>Q · 范围冻结${this.qUsed ? ' · 已用' : ''}</button>`;
  }

  private renderJournal(): void {
    if (!this.journalGrid || !this.store) return;
    this.journalGrid.innerHTML = BUGS.map((def) => {
      const caught = this.store!.isCaught(def.id);
      const tamed = this.store!.isTamed(def.id);
      const mood = caught ? this.store!.mood(def.id) : 0;
      const remain = caught ? Math.max(0, Math.ceil((100 - mood) / 30)) : 0;
      return `<button class="journal-card${caught ? '' : ' locked'}${tamed ? ' tamed' : ''}" type="button" data-id="${def.id}" style="--c:${def.color};--glow:${def.color}55" aria-label="${caught ? '打开 ' + def.name + ' 的档案' : '未收容的档案'}">
        <span class="jc-top"><span class="jc-rarity ${def.rarity}">${def.rarity}</span><span>#0${def.no}</span></span>
        <span class="jc-sprite">${bugSVG(def)}</span>
        <span class="jc-name">${caught ? def.name : '？？？'}</span>
        <span class="jc-en">${caught ? def.en : 'UNKNOWN SPECIMEN'}</span>
        <span class="jc-mood"><i style="width:${mood}%"></i></span>
        <span class="jc-foot"><span>${caught ? '情绪 ' + mood + '%' : '尚未收容'}</span><span>${tamed ? '已驯化' : caught ? '还需 ' + remain + ' 次' : 'LOCKED'}</span></span>
        <span class="jc-stamp">已驯化</span>
      </button>`;
    }).join('');
  }

  openJournal(id?: string): void {
    if (!this.scene || !this.store || this.endingOpen()) return;
    if (this.scene.isCaptureActive()) return;
    this.scene.setPaused(true);
    this.journal?.classList.add('is-open');
    this.journal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    this.renderJournal();
    this.setInteraction('');
    if (id) this.openDetail(id);
    else this.hideDetail();
    window.setTimeout(() => {
      $id<HTMLButtonElement>('btnJournalClose')?.focus();
    }, 30);
  }

  closeJournal(): void {
    if (!this.journalOpen()) return;
    this.hideDetail();
    this.journal?.classList.remove('is-open');
    this.journal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
    this.scene?.setPaused(false);
    this.blurActive();
  }

  private openDetail(id: string): void {
    const def = bugById(id);
    if (!def || !this.store?.isCaught(id)) return;
    this.detailId = id;
    this.detailReaction = '';
    this.renderDetail();
    this.detail?.classList.add('is-open');
    this.detail?.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => {
      this.detailPanel?.querySelector<HTMLButtonElement>('[data-close-detail]')?.focus();
    }, 30);
  }

  private hideDetail(): void {
    this.detail?.classList.remove('is-open');
    this.detail?.setAttribute('aria-hidden', 'true');
    this.detailId = null;
    this.detailReaction = '';
  }

  private renderDetail(): void {
    if (!this.detailId || !this.detailPanel || !this.store) return;
    const def = bugById(this.detailId);
    if (!def) return;
    const caught = this.store.isCaught(def.id);
    const tamed = this.store.isTamed(def.id);
    const mood = this.store.mood(def.id);
    const quote = this.detailReaction || (tamed ? def.lines.tamed : def.intro);
    this.detailPanel.style.setProperty('--c', def.color);
    this.detailPanel.style.setProperty('--glow', `${def.color}55`);

    this.detailPanel.innerHTML = `
      <button class="close-btn dp-close" type="button" data-close-detail aria-label="关闭档案">×</button>
      <div class="dp-head">
        <div class="dp-sprite">${bugSVG(def)}</div>
        <div>
          <span class="jc-rarity ${def.rarity}">${def.rarity}</span>
          <h3 class="dp-name">${def.name}</h3>
          <div class="dp-en">${def.en} · #0${def.no}</div>
        </div>
      </div>
      <p class="dp-desc">${def.desc}</p>
      <div class="dp-hint"><b>CAPTURE NOTE</b>${def.hint}</div>
      <div class="dp-quote">${quote}</div>
      <div class="dp-section-row"><span>情绪稳定度 / MOOD</span><b>${mood}%</b></div>
      <div class="dp-mood"><i style="width:${mood}%"></i></div>
      <div class="dp-tip">每次安抚 +30 · 完美捕捉 2 次，普通捕捉 3 次</div>
      <div class="dp-actions">
        ${SOOTHE_ACTIONS.map((a) => `<button class="dp-action" type="button" data-act="${a.key}" ${tamed ? 'disabled' : ''}><span>${a.code}</span><b>${a.label}</b></button>`).join('')}
      </div>
      ${tamed ? `<div class="dp-tamed"><b>STATUS · TAMED</b>${def.lines.tamed}</div>` : ''}
      <div class="dp-perk"><b>PERK · ${def.perkName}</b>${def.perkDesc}${tamed ? '' : ' · 驯化后解锁'}</div>
    `;
    if (!caught) {
      this.detailPanel.innerHTML = '<div class="dp-empty">档案尚未解锁</div>';
    }
  }

  private applySoothe(action: SootheAction): void {
    if (!this.detailId || !this.store) return;
    const def = bugById(this.detailId);
    if (!def || this.store.isTamed(this.detailId)) return;
    this.detailReaction = def.lines[action];
    const result = this.store.soothe(this.detailId);
    if (result.tamed) this.detailReaction = def.lines.tamed;
    this.scene?.playSoothe(result.tamed);
    this.renderDetail();
  }

  private onStoreChange(): void {
    this.renderHUD();
    this.renderPerks();
    if (this.journalOpen()) this.renderJournal();
    if (this.detailOpen()) this.renderDetail();
    this.checkEnding();
  }

  private checkEnding(initial = false): void {
    if (!this.store?.allTamed() || this.endingShown) return;
    this.endingShown = true;
    window.clearTimeout(this.endingTimer);
    this.endingTimer = window.setTimeout(() => {
      this.hideJournalUI();
      this.showEnding(initial);
    }, 700);
  }

  private showEnding(_initial: boolean): void {
    if (!this.ending || !this.store) return;
    const caught = this.store.caughtCount();
    const tamed = this.store.tamedCount();
    const perfect = BUGS.filter((b) => this.store!.isPerfect(b.id)).length;
    if (this.endingStats) {
      this.endingStats.innerHTML = `<div>收容<b>${caught}/${BUGS.length}</b></div><div>驯化<b>${tamed}/${BUGS.length}</b></div><div>完美<b>${perfect}</b></div>`;
    }
    this.ending.classList.add('is-open');
    this.ending.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    this.scene?.setPaused(true);
    window.setTimeout(() => $id<HTMLButtonElement>('btnContinue')?.focus(), 40);
  }

  private closeEnding(): void {
    if (!this.endingOpen()) return;
    this.ending?.classList.remove('is-open');
    this.ending?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
    this.scene?.setPaused(false);
    this.blurActive();
  }

  private hideJournalUI(): void {
    this.detail?.classList.remove('is-open');
    this.detail?.setAttribute('aria-hidden', 'true');
    this.detailId = null;
    this.journal?.classList.remove('is-open');
    this.journal?.setAttribute('aria-hidden', 'true');
  }

  private resetAll(): void {
    if (!this.store) return;
    const ok = window.confirm('重新开一班？所有收容和驯化记录都会清空。');
    if (!ok) return;
    this.store.reset();
    window.location.reload();
  }

  isCaptureActive(): boolean {
    return this.captureActive;
  }

  startCapture(options: CaptureOptions, onResult: (position: number) => void, onTimeout: () => void): void {
    if (!this.captureBar || !this.captureMarker) return;
    this.captureActive = true;
    this.captureResult = onResult;
    this.captureTimeout = onTimeout;
    this.captureDuration = options.duration;
    this.captureStart = performance.now();

    if (this.captureName) {
      this.captureName.textContent = options.name;
      this.captureName.style.color = options.color;
    }
    if (this.captureGreen) {
      this.captureGreen.style.left = `${options.green[0] * 100}%`;
      this.captureGreen.style.width = `${(options.green[1] - options.green[0]) * 100}%`;
    }
    if (this.captureAmber) {
      this.captureAmber.style.left = `${options.amber[0] * 100}%`;
      this.captureAmber.style.width = `${(options.amber[1] - options.amber[0]) * 100}%`;
    }
    this.captureMarker.style.left = '0%';
    this.captureBar.classList.add('show');
    this.captureBar.setAttribute('aria-hidden', 'false');

    const tick = (now: number) => {
      if (!this.captureActive) return;
      const p = Math.min(1, (now - this.captureStart) / this.captureDuration);
      if (this.captureMarker) this.captureMarker.style.left = `${p * 100}%`;
      if (p >= 1) {
        this.finishCapture(-1, true);
        return;
      }
      this.captureRAF = requestAnimationFrame(tick);
    };
    this.captureRAF = requestAnimationFrame(tick);
  }

  resolveCaptureNow(): void {
    if (!this.captureActive) return;
    const p = Math.min(0.999, (performance.now() - this.captureStart) / this.captureDuration);
    this.finishCapture(p, false);
  }

  private finishCapture(position: number, timedOut: boolean): void {
    if (!this.captureActive) return;
    this.captureActive = false;
    cancelAnimationFrame(this.captureRAF);
    this.captureBar?.classList.remove('show');
    this.captureBar?.setAttribute('aria-hidden', 'true');
    const result = this.captureResult;
    const timeout = this.captureTimeout;
    this.captureResult = null;
    this.captureTimeout = null;
    if (timedOut) timeout?.();
    else result?.(position);
  }

  private renderMinimap(): void {
    if (!this.scene || !this.store) return;
    let data;
    try {
      data = this.scene.getMinimapData();
    } catch {
      return;
    }
    if (this.mmPlayer) {
      this.mmPlayer.setAttribute('cx', data.player.x.toFixed(2));
      this.mmPlayer.setAttribute('cy', data.player.y.toFixed(2));
    }
    if (!this.mmBugs) return;
    if (!this.store.perkUnlocked('npe')) {
      this.mmBugs.innerHTML = '';
      return;
    }
    this.mmBugs.innerHTML = data.bugs
      .map((b) => `<circle class="mm-bug" cx="${b.x.toFixed(2)}" cy="${b.y.toFixed(2)}" r="0.9" fill="${b.color}"/>`)
      .join('');
  }

  private setupTouch(): void {
    if (!this.gameFrame) return;
    const isTouch = window.matchMedia('(hover: none)').matches || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    this.touchMode = isTouch;
    this.gameFrame.classList.toggle('touch-mode', isTouch);
    if (!isTouch) return;

    const joystick = $id<HTMLDivElement>('joystick');
    const knob = $id<HTMLDivElement>('joystickKnob');
    const sneakBtn = $id<HTMLButtonElement>('btnSneak');
    const netBtn = $id<HTMLButtonElement>('btnNet');
    const interactBtn = $id<HTMLButtonElement>('btnInteract');

    if (joystick && knob) {
      let pointerId: number | null = null;
      const update = (event: PointerEvent) => {
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = event.clientX - cx;
        let dy = event.clientY - cy;
        const max = rect.width * 0.32;
        const len = Math.hypot(dx, dy);
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.scene?.setTouchVector(dx / max, dy / max);
      };
      const end = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        knob.style.transform = 'translate(0,0)';
        this.scene?.setTouchVector(0, 0);
      };
      joystick.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        pointerId = event.pointerId;
        joystick.setPointerCapture(pointerId);
        update(event);
      });
      joystick.addEventListener('pointermove', (event) => {
        if (event.pointerId === pointerId) update(event);
      });
      joystick.addEventListener('pointerup', end);
      joystick.addEventListener('pointercancel', end);
      joystick.addEventListener('lostpointercapture', end);
    }

    if (sneakBtn) {
      const down = (event: PointerEvent) => {
        event.preventDefault();
        this.scene?.setTouchSneak(true);
        sneakBtn.classList.add('active');
      };
      const up = () => {
        this.scene?.setTouchSneak(false);
        sneakBtn.classList.remove('active');
      };
      sneakBtn.addEventListener('pointerdown', down);
      sneakBtn.addEventListener('pointerup', up);
      sneakBtn.addEventListener('pointerleave', up);
      sneakBtn.addEventListener('pointercancel', up);
    }

    if (netBtn) {
      netBtn.addEventListener('click', () => {
        netBtn.blur();
        if (this.captureActive) this.resolveCaptureNow();
        else this.scene?.handleNet();
      });
    }
    if (interactBtn) {
      interactBtn.addEventListener('click', () => {
        interactBtn.blur();
        this.scene?.handleInteract();
      });
    }
  }

  private isOverlayOpen(): boolean {
    return this.journalOpen() || this.detailOpen() || this.endingOpen();
  }

  private journalOpen(): boolean {
    return !!this.journal?.classList.contains('is-open');
  }

  private detailOpen(): boolean {
    return !!this.detail?.classList.contains('is-open');
  }

  private endingOpen(): boolean {
    return !!this.ending?.classList.contains('is-open');
  }

  private blurActive(): void {
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
  }
}
