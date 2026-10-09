window.MERGE_BANK = (function () {
  if (window.BANK_SHEET && window.DATA_POOL) {
    Object.keys(BANK_SHEET.pool || {}).forEach(m => {
      DATA_POOL[m] = DATA_POOL[m] || { judul: m, sumber: 'pool', pool: { M: [], S: [], U: [] } };
      ['M', 'S', 'U'].forEach(L => (BANK_SHEET.pool[m][L] || []).forEach(it => DATA_POOL[m].pool[L].push(it)));
    });
    Object.keys(BANK_SHEET.vars_wajar || {}).forEach(m => {
      DATA_POOL[m] = DATA_POOL[m] || {}; DATA_POOL[m].vars_wajar = BANK_SHEET.vars_wajar[m];
    });
  }
  return {};
})();