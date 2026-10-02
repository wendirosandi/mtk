/**
 * FUNCTIONS_RENDER.js — Render scaffold, MC, BS, feedback, KaTeX preview
 * Bagian dari arsitektur LKPD v2.0 (shell tipis + modul core)
 */

window.LKPD_RENDER = (function() {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ===== RENDER INPUT FIELD =====
  function inputField(id, type = 'text', inputmode = 'decimal', placeholder = '', extraClass = '') {
    return `<input type="${type}" id="${id}" inputmode="${inputmode}" placeholder="${placeholder}" class="q-ans w-20 p-1.5 bg-white border rounded-lg text-center font-bold ${extraClass}">`;
  }

  // ===== RENDER SELECT =====
  function selectField(id, options, extraClass = '') {
    const opts = options.map(o => `<option value="${o}">${o}</option>`).join('');
    return `<select id="${id}" class="q-sel p-1.5 border rounded-lg text-xs font-bold ${extraClass}"><option value="">?</option>${opts}</select>`;
  }

  // ===== RENDER SCAFFOLD (langkah bertahap) =====
  function renderScaffold(steps, prefix = 'step') {
    let html = '';
    steps.forEach((step, i) => {
      const id = `${prefix}-${i}`;
      if (step.type === 'equation') {
        html += `<div class="step-row"><span>${step.left}</span>${inputField(id, 'text', step.inputmode || 'decimal', '', step.extraClass || '')}<span>${step.right}</span></div>`;
      } else if (step.type === 'text') {
        html += `<div class="step-row"><span>${step.text}</span></div>`;
      } else if (step.type === 'continuation') {
        html += `<div class="step-row step-continuation"><span>${step.left}</span>${inputField(id, 'text', step.inputmode || 'decimal', '', step.extraClass || '')}<span>${step.right}</span></div>`;
      }
    });
    return html;
  }

  // ===== RENDER MULTIPLE CHOICE (MC) =====
  function renderMC(options, name = 'mc', labels = ['A', 'B', 'C', 'D']) {
    const html = options.map((opt, i) => {
      const val = typeof opt === 'string' ? opt : opt.val;
      const isCorrect = typeof opt === 'object' && opt.correct;
      return `<label class="mc-option flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-indigo-50 transition" data-idx="${i}">
        <input type="radio" name="${name}" value="${i}" class="mc-radio w-5 h-5" ${isCorrect ? 'data-correct="true"' : ''}>
        <span class="font-bold text-indigo-700">${labels[i]}.</span>
        <span class="mc-tex flex-1" data-tex="${val}"></span>
      </label>`;
    }).join('');
    return `<div class="space-y-2">${html}</div>`;
  }

  // ===== RENDER MC GRUP (2-3 pertanyaan per soal) =====
  function renderMCGroup(questions) {
    const labels = ['A', 'B', 'C', 'D'];
    let html = '';
    questions.forEach((q, qi) => {
      const name = `mc${qi + 1}`;
      html += `<div class="mb-4"><b>${q.label} = ?</b><div class="space-y-2 mt-2">`;
      q.options.forEach((opt, i) => {
        const val = typeof opt === 'string' ? opt : opt.val;
        const isCorrect = typeof opt === 'object' && opt.correct;
        html += `<label class="mc-option flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-indigo-50 transition" data-idx="${i}">
          <input type="radio" name="${name}" value="${i}" class="mc-radio w-5 h-5" ${isCorrect ? 'data-correct="true"' : ''}>
          <span class="font-bold text-indigo-700">${labels[i]}.</span>
          <span class="mc-val flex-1">${val}</span>
        </label>`;
      });
      html += `</div></div>`;
    });
    return `<div class="grid grid-cols-1 gap-4 mt-3">${html}</div>`;
  }

  // ===== RENDER BENAR/SALAH (BS) =====
  function renderBS(items, prefix = 'bs') {
    const html = items.map((item, i) => {
      const order = Math.random() < 0.5 ? ['Benar', 'Salah'] : ['Salah', 'Benar'];
      return `<div class="flex items-center gap-2 border rounded-xl p-2 bg-white mb-2" data-bs-row="${i}" data-correct="${item.ok ? 'Benar' : 'Salah'}">
        <span class="flex-1 text-sm font-semibold">${item.txt}</span>
        <span class="flex gap-1">
          ${order.map(v => `<button class="q-bs px-3 py-1.5 rounded-lg text-xs font-bold" data-i="${i}" data-v="${v}">${v === 'Benar' ? '✅ Benar' : '❌ Salah'}</button>`).join('')}
        </span>
      </div>`;
    }).join('');
    return html;
  }

  // ===== RENDER PECAHAN (drag/tap) =====
  function renderFraction(cardId, numeratorZoneId, denominatorInputId, bankItems) {
    const bankHtml = bankItems.map((item, idx) => {
      const val = typeof item === 'string' ? item : item.latex;
      return `<div class="k1-bank-item" data-ci="${cardId}" data-val="${val}" id="k1-bank-${cardId}-${idx}">${val}</div>`;
    }).join('');
    
    return `<div class="flex items-center justify-center gap-2 text-xl font-bold text-indigo-800">
      <span>=</span>
      <div class="k1-fraction">
        <div class="k1-num-zone" id="${numeratorZoneId}" data-ci="${cardId}">
          <span class="text-slate-400 text-sm font-normal" id="k1-num-placeholder-${cardId}">ketuk di sini</span>
        </div>
        <div style="width:100%;height:2px;background:#334155;margin:4px 0;"></div>
        <input type="text" inputmode="numeric" maxlength="3" class="k1-den-input" id="${denominatorInputId}" placeholder="?">
      </div>
    </div>
    <div class="k1-bank" id="k1-bank-${cardId}">${bankHtml}</div>`;
  }

  // ===== RENDER SVG CONTAINER =====
  function renderSVG(svgString, caption = 'Gambar ilustrasi, tidak berskala tepat.') {
    return `<div class="svg-container bg-white rounded-xl border mb-2 py-2">${svgString}</div>
            <div class="text-xs text-slate-500 mb-1 italic">${caption}</div>`;
  }

  // ===== RENDER SOAL BOX (pernyataan teks) =====
  function renderSoalBox(text) {
    return `<div class="bg-slate-50 border-l-4 border-indigo-500 rounded-r-xl p-3 mb-3 text-sm font-medium text-slate-800">${text}</div>`;
  }

  // ===== RENDER KATEX PREVIEW =====
  function renderKatexPreview(inputId, previewId) {
    return `<div class="mt-2 text-sm bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">Preview: <span id="${previewId}" class="font-bold text-indigo-800"></span></div>`;
  }

  // ===== RENDER FEEDBACK (pasca-CEK) =====
  function renderFeedback(element, isCorrect) {
    if (!element) return;
    element.classList.remove('input-correct', 'input-wrong', 'correct', 'wrong');
    if (element.classList.contains('mc-option')) {
      element.classList.add(isCorrect ? 'correct' : 'wrong');
    } else {
      element.classList.add(isCorrect ? 'input-correct' : 'input-wrong');
    }
    // Tambah ikon ✅/❌
    const existing = element.nextElementSibling;
    if (existing && existing.classList.contains('ans-mark')) existing.remove();
    const mark = document.createElement('span');
    mark.className = 'ans-mark';
    mark.style.cssText = 'font-size:11px;pointer-events:none;margin-left:2px;';
    mark.textContent = isCorrect ? '✅' : '❌';
    element.insertAdjacentElement('afterend', mark);
  }

  // ===== RENDER FEEDBACK MC GRUP =====
  function renderFeedbackMCGroup(name, opts) {
    const radios = document.querySelectorAll(`#g-question-area [name="${name}"]`);
    radios.forEach((radio, i) => {
      const opt = radio.closest('.mc-option');
      if (!opt) return;
      opt.classList.remove('correct', 'wrong', 'show-correct');
      if (opts[i] && opts[i].correct) opt.classList.add('show-correct');
      if (radio.checked) {
        if (opts[i] && opts[i].correct) opt.classList.add('correct');
        else opt.classList.add('wrong');
      }
      radio.disabled = true;
    });
  }

  // ===== RENDER FEEDBACK BS =====
  function renderFeedbackBS(items) {
    items.forEach((item, i) => {
      const row = document.querySelector(`[data-bs-row="${i}"]`);
      if (!row) return;
      const btns = row.querySelectorAll('.q-bs');
      const sel = Array.from(btns).find(b => b.classList.contains('sel'));
      const correctVal = item.ok ? 'Benar' : 'Salah';
      const correctBtn = Array.from(btns).find(b => b.dataset.v === correctVal);
      
      btns.forEach(b => {
        b.disabled = true;
        b.classList.remove('sel');
        if (b === sel) {
          b.style.boxShadow = item.ok ? '0 0 0 4px #86efac' : '0 0 0 4px #fca5a5';
        }
        if (b === correctBtn && b !== sel) {
          b.style.outline = '2px solid #10b981';
          b.style.outlineOffset = '2px';
        }
      });
      
      // Tambah ikon di ujung baris
      const icon = document.createElement('span');
      icon.className = 'ans-mark';
      icon.style.cssText = 'font-size:14px;margin-left:8px;';
      icon.textContent = item.ok ? '✅' : '❌';
      row.appendChild(icon);
    });
  }

  // ===== WIRE KATEX RENDER =====
  function wireKatex(root) {
    $$(root + ' .q-tex').forEach(el => {
      try {
        if (window.katex) katex.render(el.dataset.tex, el, { throwOnError: false });
      } catch (e) {
        el.innerText = el.dataset.tex;
      }
    });
    $$(root + ' .mc-tex').forEach(el => {
      try {
        if (window.katex) katex.render(el.dataset.tex, el, { throwOnError: false });
      } catch (e) {
        el.innerText = el.dataset.tex;
      }
    });
    $$(root + ' .k1-bank-item').forEach(el => {
      if (!el.querySelector('.katex-rendered') && el.dataset.val && el.dataset.val.includes('\\')) {
        const span = document.createElement('span');
        span.className = 'katex-rendered';
        try {
          if (window.katex) katex.render(el.dataset.val, span, { throwOnError: false });
        } catch (e) {
          span.innerText = el.dataset.val;
        }
        el.innerHTML = '';
        el.appendChild(span);
      }
    });
  }

  // ===== WIRE MC OPTIONS =====
  function wireMC(root) {
    $$(root + ' .mc-option').forEach(opt => {
      opt.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT') return;
        const radio = this.querySelector('.mc-radio');
        radio.checked = true;
        const name = radio.name;
        $$(root + ' .mc-option').forEach(o => {
          if (o.querySelector('.mc-radio').name === name) o.classList.remove('selected');
        });
        this.classList.add('selected');
        if (window.updateBtn) window.updateBtn();
      });
    });
    $$(root + ' .mc-radio').forEach(r => {
      r.addEventListener('change', function() {
        const name = this.name;
        $$(root + ' .mc-option').forEach(o => {
          if (o.querySelector('.mc-radio').name === name) o.classList.remove('selected');
        });
        this.closest('.mc-option').classList.add('selected');
        if (window.updateBtn) window.updateBtn();
      });
    });
  }

  // ===== WIRE BS =====
  function wireBS(root) {
    $$(root + ' .q-bs').forEach(b => {
      b.addEventListener('click', function() {
        const i = this.dataset.i;
        $$(root + ' .q-bs').forEach(x => {
          if (x.dataset.i === i) x.classList.remove('sel', 'ring-4', 'ring-teal-300');
        });
        this.classList.add('sel', 'ring-4', 'ring-teal-300');
        if (window.updateBtn) window.updateBtn();
      });
    });
  }

  // ===== PUBLIC API =====
  return {
    inputField,
    selectField,
    renderScaffold,
    renderMC,
    renderMCGroup,
    renderBS,
    renderFraction,
    renderSVG,
    renderSoalBox,
    renderKatexPreview,
    renderFeedback,
    renderFeedbackMCGroup,
    renderFeedbackBS,
    wireKatex,
    wireMC,
    wireBS
  };
})();