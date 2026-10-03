window.PLAIN = (function () {
  const isSimple = s => /^\d+(\.\d+)?$/.test(String(s).trim());
  const frac = (a, b) => (isSimple(a) ? a : '(' + a + ')') + '/' + (isSimple(b) ? b : '(' + b + ')');
  function plainTex(s) {
    let x = String(s);
    x = x.replace(/(\d),(\d)/g, '$1.$2');                       // desimal koma→titik
    x = x.replace(/\\sqrt\{([^{}]*)\}/g, (m, q) => '√' + (isSimple(q) ? q : '(' + q + ')'));
    x = x.replace(/\\sqrt(\d)/g, '√$1');
    x = x.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (m, a, b) => frac(a, b));
    x = x.replace(/\^\{([^{}]*)\}/g, '^$1');
    x = x.replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\cdot/g, '·');
    x = x.replace(/\\left|\\right/g, '').replace(/\\[,;! ]/g, '');
    x = x.replace(/[{}]/g, '');
    return x.trim();
  }
  const S = t => 'S(' + t + ')';
  const fmark = ok => ok ? '✓' : '✗';
  const qmark = ok => ok ? '☑' : '☒';
  return { plainTex, S, fmark, qmark, frac, isSimple };
})();