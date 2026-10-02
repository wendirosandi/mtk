/**
 * SCORING_LOGIC.js — Normalisasi, parsing, dan perhitungan skor
 * Bagian dari arsitektur LKPD v2.0 (shell tipis + modul core)
 */

window.LKPD_SCORING = (function() {
  'use strict';

  // ===== UTILITAS DASAR =====
  const r6 = v => Math.round(v * 1e6) / 1e6;
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
  const normNum = v => {
    const n = parseFloat(String(v).trim().replace(/,/g, '.').replace(/\.(?=.*\.)/g, ''));
    return isNaN(n) ? null : n;
  };
  const normExpr = s => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/×/g, '').replace(/\*/g, '').replace(/−/g, '-').replace(/,/g, '.');

  // ===== NORMALISASI JAWABAN =====
  function normalizeAnswer(raw, type) {
    if (!raw) return null;
    if (type === 'num') return normNum(raw);
    if (type === 'expr') return normExpr(raw);
    return String(raw).trim();
  }

  // ===== PARSING PECAHAN =====
  function parseFraction(str) {
    if (!str || typeof str !== 'string') return null;
    const m = String(str).match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    return { num: parseInt(m[1]), den: parseInt(m[2]) };
  }

  // ===== PARSING AKAR =====
  function parseRadical(str) {
    if (!str || typeof str !== 'string') return null;
    const m = String(str).match(/^(\d+)?\s*√\s*(\d+)$/);
    if (!m) return null;
    return { coef: m[1] ? parseInt(m[1]) : 1, radicand: parseInt(m[2]) };
  }

  // ===== PARSING PANGKAT =====
  function parsePower(str) {
    if (!str || typeof str !== 'string') return null;
    const m = String(str).match(/^(\d+)\^(\-?\d+)$/);
    if (!m) return null;
    return { base: parseInt(m[1]), exp: parseInt(m[2]) };
  }

  // ===== COMPARATOR JAWABAN =====
  function compareAnswer(studentAns, correctKey, type = 'num', alts = []) {
    if (!studentAns) return false;
    
    const sNorm = normalizeAnswer(studentAns, type);
    const kNorm = normalizeAnswer(correctKey, type);
    
    // Banding langsung
    if (type === 'num' && sNorm !== null && kNorm !== null) {
      if (near(sNorm, kNorm)) return true;
    } else {
      if (sNorm === kNorm) return true;
    }
    
    // Banding dengan alternatif
    if (alts && alts.length) {
      for (const alt of alts) {
        const aNorm = normalizeAnswer(alt, type);
        if (type === 'num' && sNorm !== null && aNorm !== null) {
          if (near(sNorm, aNorm)) return true;
        } else {
          if (sNorm === aNorm) return true;
        }
      }
    }
    
    return false;
  }

  // ===== PERHITUNGAN SKOR PARSIAL =====
  function calculatePartialScore(inputs, keys, type = 'num') {
    if (!inputs || !keys || inputs.length !== keys.length) return 0;
    let correct = 0;
    for (let i = 0; i < inputs.length; i++) {
      if (compareAnswer(inputs[i], keys[i], type)) {
        correct++;
      }
    }
    return inputs.length > 0 ? correct / inputs.length : 0;
  }

  // ===== PERHITUNGAN BOBOT =====
  function applyBobot(partialScore, bobot) {
    return +(partialScore * bobot).toFixed(2);
  }

  // ===== PEMBULATAN AKHIR =====
  function roundFinalScore(score, decimals = 0) {
    const factor = Math.pow(10, decimals);
    return Math.round(score * factor) / factor;
  }

  // ===== AUDIT: VERIFIKASI INPUT DOM vs KUNCI =====
  function auditInputCount(domInputs, expectedKeys) {
    const domLen = domInputs ? domInputs.length : 0;
    const keyLen = expectedKeys ? expectedKeys.length : 0;
    if (domLen !== keyLen) {
      console.warn(`[AUDIT] Input DOM (${domLen}) ≠ kunci (${keyLen})`);
      return false;
    }
    return true;
  }

  // ===== NORMALISASI KUNCI JAWABAN =====
  function normalizeKey(key) {
    if (typeof key === 'number') return key;
    if (typeof key === 'string') {
      const n = normNum(key);
      return n !== null ? n : key;
    }
    return key;
  }

  // ===== PUBLIC API =====
  return {
    r6,
    near,
    normNum,
    normExpr,
    normalizeAnswer,
    parseFraction,
    parseRadical,
    parsePower,
    compareAnswer,
    calculatePartialScore,
    applyBobot,
    roundFinalScore,
    auditInputCount,
    normalizeKey
  };
})();