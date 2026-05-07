"use strict";

// ========== Business Logic ==========

function formatMoney(v) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v).replace(/ /g, " ") + " zł";
}
function formatPercent(v) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function calculateBelow(input) {
  var rw = input.valuePerSqm * 0.9;
  var offer30 = rw * 0.7;
  var pcc = (offer30 + input.totalDebt) * 0.02;
  var costs = offer30 + (offer30 * input.commissionPct) + pcc + input.notaryFee;
  var investment = costs;
  var profit = rw - investment;
  var roi = investment > 0 ? profit / investment : 0;
  var decision = (profit >= 60000 || roi >= 0.36) ? "OK" : "NIE";
  var result = { rw: rw, offerMinus30: offer30, pcc: pcc, costs: costs, investment: investment, profit: profit, roi: roi, decision: decision };
  if (input.manualOffer != null && input.manualOffer > 0) {
    var mo = input.manualOffer;
    var fo = mo * 0.85;
    var pcc2 = mo * 0.02;
    var nf2 = 1000;
    var costs2 = mo + (mo * input.commissionPct) + pcc2 + nf2;
    var inv2 = costs2;
    var profit2 = rw - inv2;
    var roi2 = inv2 > 0 ? profit2 / inv2 : 0;
    var dec2 = (profit2 >= 60000 || roi2 >= 0.36) ? "OK" : "NIE";
    result.manual = { firstOffer: fo, maxOffer: mo, pcc: pcc2, notaryFee: nf2, costs: costs2, investment: inv2, profit: profit2, roi: roi2, decision: dec2 };
  }
  return result;
}

function computeWeightedSplit(amounts, totalDebt, pool, weights) {
  var indexed = amounts.map(function(a, i) { return { amount: a, index: i }; });
  var nonZero = indexed.filter(function(c) { return c.amount > 0; });
  if (nonZero.length === 0) return amounts.map(function() { return { rawShare: 0, weight: 1, weightedShare: 0, normalizedShare: 0, offerAmount: 0 }; });
  var sorted = nonZero.slice().sort(function(a, b) { return b.amount - a.amount; });
  var weightMap = {};
  if (sorted.length === 1) { weightMap[sorted[0].index] = 1.0; }
  else if (sorted.length === 2) { weightMap[sorted[0].index] = weights.largest; weightMap[sorted[1].index] = weights.smallest; }
  else { weightMap[sorted[0].index] = weights.largest; weightMap[sorted[1].index] = weights.middle; weightMap[sorted[2].index] = weights.smallest; }
  var breakdowns = amounts.map(function(amount, i) {
    var rawShare = totalDebt > 0 ? amount / totalDebt : 0;
    var weight = weightMap[i] || 0;
    return { rawShare: rawShare, weight: weight, weightedShare: rawShare * weight, normalizedShare: 0, offerAmount: 0 };
  });
  var totalWeighted = breakdowns.reduce(function(s, b) { return s + b.weightedShare; }, 0);
  if (totalWeighted > 0) breakdowns.forEach(function(b) { b.normalizedShare = b.weightedShare / totalWeighted; b.offerAmount = pool * b.normalizedShare; });
  return breakdowns;
}

function calculateAbove(input) {
  var weights = input.weights || { largest: 1.3, middle: 1.0, smallest: 0.7 };
  var rw = input.valuePerSqm * 0.9;
  var c1s = input.totalDebt > 0 ? input.creditor1 / input.totalDebt : 0;
  var c2s = input.totalDebt > 0 ? input.creditor2 / input.totalDebt : 0;
  var c3s = input.totalDebt > 0 ? input.creditor3 / input.totalDebt : 0;
  var offer30 = rw * 0.7;
  var ownerOffer = offer30 * input.ownerCoefficient;
  var credPool = offer30 - ownerOffer;
  var amounts = [input.creditor1, input.creditor2, input.creditor3];
  var bd = computeWeightedSplit(amounts, input.totalDebt, credPool, weights);
  var pcc = offer30 * 0.02;
  var costs = offer30 + (offer30 * input.commissionPct) + pcc + input.notaryFee;
  var investment = costs;
  var profit = rw - investment;
  var roi = investment > 0 ? profit / investment : 0;
  var decision = (profit >= 60000 || roi >= 0.36) ? "OK" : "NIE";
  var result = {
    rw: rw, creditor1Share: c1s, creditor2Share: c2s, creditor3Share: c3s,
    offerMinus30: offer30, ownerOffer: ownerOffer,
    creditor1Offer: bd[0].offerAmount, creditor2Offer: bd[1].offerAmount, creditor3Offer: bd[2].offerAmount,
    creditorBreakdown: bd, pcc: pcc, costs: costs, investment: investment, profit: profit, roi: roi, decision: decision
  };
  if (input.manualOffer != null && input.manualOffer > 0) {
    var mo = input.manualOffer;
    var oom = mo * input.ownerCoefficient;
    var mp = mo - oom;
    var mbd = computeWeightedSplit(amounts, input.totalDebt, mp, weights);
    var mpcc = mo * 0.02;
    var mc = mo + (mo * input.commissionPct) + mpcc + input.notaryFee;
    var mi = mc; var mprofit = rw - mi; var mroi = mi > 0 ? mprofit / mi : 0;
    var mdec = (mprofit >= 60000 || mroi >= 0.36) ? "OK" : "NIE";
    result.manual = {
      maxOffer: mo, ownerOffer: oom,
      creditor1Offer: mbd[0].offerAmount, creditor2Offer: mbd[1].offerAmount, creditor3Offer: mbd[2].offerAmount,
      creditorBreakdown: mbd, pcc: mpcc, costs: mc, investment: mi, profit: mprofit, roi: mroi, decision: mdec
    };
  }
  return result;
}

// ========== React Components ==========
var e = React.createElement;

function ResultCard(props) {
  return e("div", { className: "lk-result-card" },
    e("p", { className: "lk-result-label" }, props.label),
    e("p", { className: "lk-result-value" }, props.value),
    props.sublabel && e("p", { className: "lk-result-sublabel" }, props.sublabel)
  );
}

function Decision(props) {
  var ok = props.decision === "OK";
  return e("div", { className: "lk-decision " + (ok ? "ok" : "nie") },
    e("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" } },
      e("span", { style: { fontSize: "1.5rem" } }, ok ? "✅" : "❌"),
      e("div", null,
        e("p", { className: "lk-result-label" }, props.label || "Wynik kalkulacji"),
        e("p", { className: "lk-decision-title " + (ok ? "ok" : "nie") }, props.decision)
      )
    ),
    e("div", { className: "lk-grid lk-grid-2" },
      e("div", null,
        e("p", { className: "lk-result-label" }, "Zysk"),
        e("p", { className: "lk-profit-value " + (ok ? "lk-green" : "lk-red") }, formatMoney(props.profit))
      ),
      e("div", null,
        e("p", { className: "lk-result-label" }, "ROI"),
        e("p", { className: "lk-profit-value " + (props.roi >= 0.36 ? "lk-green" : "lk-red") }, formatPercent(props.roi))
      )
    ),
    !ok && e("p", { style: { fontSize: "0.7rem", color: "var(--lk-text-dim)", marginTop: "12px" } }, "Min. zysk: 60 000 zł lub ROI ≥ 36%")
  );
}

function InputField(props) {
  return e("div", { key: props.key, className: props.className || "" },
    e("label", { className: "lk-label" }, props.label),
    e("input", {
      className: "lk-input",
      type: props.type || "number",
      inputMode: props.inputMode,
      value: props.value,
      onChange: props.onChange,
      onBlur: props.onBlur,
      placeholder: props.placeholder,
      min: props.min,
      step: props.step,
      max: props.max
    }),
    props.hint && e("span", { style: { fontSize: "0.65rem", color: "var(--lk-text-dim)" } }, props.hint)
  );
}

function usePctField(commissionPct, onChangeCommission) {
  var st = React.useState(commissionPct ? (commissionPct * 100).toString() : "");
  var raw = st[0]; var setRaw = st[1];
  var lastExternal = React.useRef(commissionPct);
  if (commissionPct !== lastExternal.current) {
    lastExternal.current = commissionPct;
    var expected = commissionPct ? (commissionPct * 100).toString() : "";
    var currentNum = parseFloat(raw.replace(",", "."));
    if (isNaN(currentNum) || Math.abs(currentNum - commissionPct * 100) > 0.0001) {
      setRaw(expected);
    }
  }
  function onChange(ev) {
    var val = ev.target.value.replace(",", ".");
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setRaw(val);
      var v = parseFloat(val);
      onChangeCommission("commissionPct", isNaN(v) ? 0 : v / 100);
    }
  }
  function onBlur() {
    var v = parseFloat(raw.replace(",", "."));
    if (isNaN(v) || raw === "") { setRaw(""); }
  }
  return { value: raw, onChange: onChange, onBlur: onBlur };
}

function Calc1(props) {
  var inp = props.input;
  var result = inp.valuePerSqm ? calculateBelow(inp) : null;
  var pct = usePctField(inp.commissionPct, props.onChange);

  function hn(key, val) { var n = parseFloat(val); props.onChange(key, isNaN(n) ? null : n); }

  return e("div", null,
    e("div", null,
      e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Dane wejściowe"),
      e("div", { className: "lk-grid lk-grid-2" },
        InputField({ label: "Wartość po najniższej m² (I) [zł]", value: inp.valuePerSqm || "", onChange: function(ev) { hn("valuePerSqm", ev.target.value); }, placeholder: "656000", min: "0", step: "1000" }),
        InputField({ label: "Zadłużenie (K) [zł]", value: inp.totalDebt || "", onChange: function(ev) { hn("totalDebt", ev.target.value); }, placeholder: "0", min: "0", step: "1000" }),
        InputField({ label: "Prowizja pośrednika (L) [%]", type: "text", inputMode: "decimal", value: pct.value, onChange: pct.onChange, onBlur: pct.onBlur, placeholder: "2.46" }),
        InputField({ label: "Taksa notarialna (O) [zł]", value: inp.notaryFee || "", onChange: function(ev) { hn("notaryFee", ev.target.value); }, placeholder: "1000", min: "0" }),
        InputField({ label: "Ręczna oferta (U) [zł] — opcjonalnie", className: "lk-col-span-2", value: inp.manualOffer || "", onChange: function(ev) { var v = parseFloat(ev.target.value); props.onChange("manualOffer", isNaN(v) ? null : v); }, placeholder: "445000", min: "0", step: "1000" })
      )
    ),
    e("div", { className: "lk-spacer" },
      result ? e("div", null,
        e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Wyniki — Wariant standardowy"),
        e("div", { className: "lk-grid lk-grid-3" },
          ResultCard({ label: "RW (J)", value: formatMoney(result.rw), sublabel: "= I × 0.9" }),
          ResultCard({ label: "Oferta −30% (M)", value: formatMoney(result.offerMinus30), sublabel: "= J × 0.7" }),
          ResultCard({ label: "PCC (N)", value: formatMoney(result.pcc), sublabel: "= (M+K) × 2%" }),
          ResultCard({ label: "Koszty (P)", value: formatMoney(result.costs), sublabel: "= M + prow. + PCC + taksa" }),
          ResultCard({ label: "Wkład (Q)", value: formatMoney(result.investment) })
        ),
        Decision({ profit: result.profit, roi: result.roi, decision: result.decision, label: "Decyzja — wariant standardowy" }),
        result.manual && e("div", { className: "lk-spacer" },
          e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Wariant z ręczną ofertą (U = " + formatMoney(result.manual.maxOffer) + ")"),
          e("div", { className: "lk-grid lk-grid-3" },
            ResultCard({ label: "Pierwsza oferta (C)", value: formatMoney(result.manual.firstOffer), sublabel: "= U × 0.85" }),
            ResultCard({ label: "Max oferta (D)", value: formatMoney(result.manual.maxOffer) }),
            ResultCard({ label: "PCC (V)", value: formatMoney(result.manual.pcc), sublabel: "= U × 2%" }),
            ResultCard({ label: "Koszty (X)", value: formatMoney(result.manual.costs), sublabel: "= U + prow. + PCC + taksa" }),
            ResultCard({ label: "Wkład (Y)", value: formatMoney(result.manual.investment) })
          ),
          Decision({ profit: result.manual.profit, roi: result.manual.roi, decision: result.manual.decision, label: "Decyzja — ręczna oferta" })
        )
      ) : e("div", { className: "lk-empty" }, "Wpisz wartość nieruchomości (I), aby zobaczyć wyniki")
    )
  );
}

function Calc2(props) {
  var inp = props.input;
  var weightsState = React.useState({ largest: 1.3, middle: 1.0, smallest: 0.7 });
  var weights = weightsState[0];
  var setWeights = weightsState[1];
  var pct = usePctField(inp.commissionPct, props.onChange);

  var result = inp.valuePerSqm ? calculateAbove(Object.assign({}, inp, { weights: weights })) : null;

  function hn(key, val) { var n = parseFloat(val); props.onChange(key, isNaN(n) ? null : n); }

  var credLabels = [
    { key: "creditor1", label: "Kwota 1. wierzyciela (L) [zł]", ph: "600000" },
    { key: "creditor2", label: "Kwota 2. wierzyciela (M) [zł]", ph: "150000" },
    { key: "creditor3", label: "Kwota 3. wierzyciela (N) [zł]", ph: "40000" },
  ];

  var weightDefs = [
    { key: "largest", label: "Największy" },
    { key: "middle", label: "Średni" },
    { key: "smallest", label: "Najmniejszy" },
  ];

  return e("div", null,
    e("div", null,
      e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Dane podstawowe"),
      e("div", { className: "lk-grid lk-grid-2" },
        InputField({ label: "Wartość po najniższej m² (I) [zł]", value: inp.valuePerSqm || "", onChange: function(ev) { hn("valuePerSqm", ev.target.value); }, placeholder: "656000", min: "0", step: "1000" }),
        InputField({ label: "Całk. zadłużenie (K) [zł]", value: inp.totalDebt || "", onChange: function(ev) { hn("totalDebt", ev.target.value); }, placeholder: "790000", min: "0", step: "1000" }),
        InputField({ label: "Prowizja pośrednika (W) [%]", type: "text", inputMode: "decimal", value: pct.value, onChange: pct.onChange, onBlur: pct.onBlur, placeholder: "2.46" }),
        InputField({ label: "Taksa notarialna (Z) [zł]", value: inp.notaryFee || "", onChange: function(ev) { hn("notaryFee", ev.target.value); }, placeholder: "1000", min: "0" })
      )
    ),
    e("div", { className: "lk-spacer" },
      e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Wierzyciele"),
      e("div", { className: "lk-grid lk-grid-2" },
        credLabels.map(function(c) { return InputField({ key: c.key, label: c.label, value: inp[c.key] || "", onChange: function(ev) { hn(c.key, ev.target.value); }, placeholder: c.ph, min: "0", step: "1000" }); }),
        InputField({ label: "Wsp. właściciela (R)", value: inp.ownerCoefficient || "", onChange: function(ev) { hn("ownerCoefficient", ev.target.value); }, placeholder: "0.025", min: "0", max: "1", step: "0.001", hint: "Domyślnie 0.025 = 2.5%" }),
        InputField({ label: "Ręczna oferta max (AF) [zł] — opcjonalnie", className: "lk-col-span-2", value: inp.manualOffer || "", onChange: function(ev) { var v = parseFloat(ev.target.value); props.onChange("manualOffer", isNaN(v) ? null : v); }, placeholder: "500000", min: "0", step: "1000" })
      )
    ),
    e("div", { className: "lk-spacer" },
      e("div", { className: "lk-card-accent" },
        e("p", { className: "lk-eyebrow", style: { marginBottom: "10px" } }, "Wagi podziału wierzycieli"),
        e("p", { style: { fontSize: "0.7rem", color: "var(--lk-text-muted)", marginBottom: "14px" } }, "Wierzyciel z największym udziałem dostaje relatywnie więcej. Suma wag nie musi być równa 3."),
        e("div", { className: "lk-weights-grid" },
          weightDefs.map(function(w) {
            return e("div", { key: w.key },
              e("label", { style: { display: "block", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lk-text-muted)", marginBottom: "4px" } }, w.label),
              e("input", { className: "lk-range", type: "range", min: "0.1", max: "2", step: "0.05", value: weights[w.key], onChange: function(ev) { var nw = Object.assign({}, weights); nw[w.key] = parseFloat(ev.target.value); setWeights(nw); } }),
              e("span", { className: "lk-weight-val" }, weights[w.key].toFixed(2) + "×")
            );
          })
        ),
        e("button", { className: "lk-reset-btn", onClick: function() { setWeights({ largest: 1.3, middle: 1.0, smallest: 0.7 }); } }, "Przywróć domyślne (1.3 / 1.0 / 0.7)")
      )
    ),
    e("div", { className: "lk-spacer" },
      result ? e("div", null,
        e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Wyniki — Oferta −30%"),
        e("div", { className: "lk-grid lk-grid-3" },
          ResultCard({ label: "RW (J)", value: formatMoney(result.rw), sublabel: "= I × 0.9" }),
          ResultCard({ label: "Pula oferty (X)", value: formatMoney(result.offerMinus30), sublabel: "= J × 0.7" }),
          ResultCard({ label: "Oferta właściciela (V)", value: formatMoney(result.ownerOffer), sublabel: "= X × " + ((inp.ownerCoefficient || 0.025) * 100).toFixed(1) + "%" }),
          ResultCard({ label: "PCC (Y)", value: formatMoney(result.pcc), sublabel: "= X × 2%" }),
          ResultCard({ label: "Koszty (AA)", value: formatMoney(result.costs), sublabel: "= X + prow. + PCC + taksa" }),
          ResultCard({ label: "Wkład (AB)", value: formatMoney(result.investment) })
        ),
        (inp.creditor1 || inp.creditor2 || inp.creditor3) && e("div", { className: "lk-card", style: { marginTop: "16px" } },
          e("p", { style: { fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lk-text-muted)", marginBottom: "12px" } }, "Podział dla wierzycieli"),
          [
            { label: "Wierzyciel 1", offer: result.creditor1Offer, bd: result.creditorBreakdown[0], total: inp.creditor1 || 0 },
            { label: "Wierzyciel 2", offer: result.creditor2Offer, bd: result.creditorBreakdown[1], total: inp.creditor2 || 0 },
            { label: "Wierzyciel 3", offer: result.creditor3Offer, bd: result.creditorBreakdown[2], total: inp.creditor3 || 0 },
          ].filter(function(c) { return c.total > 0; }).map(function(c) {
            return e("div", { key: c.label, className: "lk-cred-row" },
              e("span", { className: "lk-cred-label" }, c.label),
              e("div", { className: "lk-bar-track" }, e("div", { className: "lk-bar-fill", style: { width: (c.bd.normalizedShare * 100).toFixed(1) + "%" } })),
              e("span", { className: "lk-cred-val" }, formatMoney(c.offer)),
              e("span", { className: "lk-cred-pct" }, (c.bd.normalizedShare * 100).toFixed(1) + "%"),
              e("span", { className: "lk-cred-wgt" }, "×" + c.bd.weight.toFixed(2))
            );
          }),
          e("p", { style: { fontSize: "0.65rem", color: "var(--lk-text-dim)", marginTop: "12px" } },
            "Suma: Właściciel " + formatMoney(result.ownerOffer) + " + Wierzyciele " +
            formatMoney(result.creditor1Offer + result.creditor2Offer + result.creditor3Offer) +
            " = " + formatMoney(result.offerMinus30)
          )
        ),
        Decision({ profit: result.profit, roi: result.roi, decision: result.decision, label: "Decyzja — wariant standardowy" }),
        result.manual && e("div", { className: "lk-spacer" },
          e("p", { className: "lk-eyebrow", style: { marginBottom: "16px" } }, "Wariant z ręczną ofertą max (AF = " + formatMoney(result.manual.maxOffer) + ")"),
          e("div", { className: "lk-grid lk-grid-3" },
            ResultCard({ label: "Oferta właściciela (AJ)", value: formatMoney(result.manual.ownerOffer) }),
            ResultCard({ label: "Wierzyciel 1 (AG)", value: formatMoney(result.manual.creditor1Offer) }),
            ResultCard({ label: "Wierzyciel 2 (AH)", value: formatMoney(result.manual.creditor2Offer) }),
            ResultCard({ label: "Wierzyciel 3 (AI)", value: formatMoney(result.manual.creditor3Offer) }),
            ResultCard({ label: "PCC (AK)", value: formatMoney(result.manual.pcc) }),
            ResultCard({ label: "Koszty (AM)", value: formatMoney(result.manual.costs) })
          ),
          Decision({ profit: result.manual.profit, roi: result.manual.roi, decision: result.manual.decision, label: "Decyzja — ręczna oferta max" })
        )
      ) : e("div", { className: "lk-empty" }, "Wpisz wartość nieruchomości (I), aby zobaczyć wyniki")
    )
  );
}

// ========== Main App (exported as global) ==========

window.LimonaKalkulator = function LimonaKalkulator() {
  var modeState = React.useState("below");
  var mode = modeState[0]; var setMode = modeState[1];

  var c1State = React.useState({ valuePerSqm: 0, totalDebt: 0, commissionPct: 0, notaryFee: 1000, manualOffer: null });
  var calc1 = c1State[0]; var setCalc1 = c1State[1];

  var c2State = React.useState({ valuePerSqm: 0, totalDebt: 0, creditor1: 0, creditor2: 0, creditor3: 0, ownerCoefficient: 0.025, commissionPct: 0, notaryFee: 1000, manualOffer: null });
  var calc2 = c2State[0]; var setCalc2 = c2State[1];

  function onChange1(key, val) { setCalc1(function(p) { var n = Object.assign({}, p); n[key] = val !== null ? val : 0; return n; }); }
  function onChange2(key, val) { setCalc2(function(p) { var n = Object.assign({}, p); n[key] = val !== null ? val : 0; return n; }); }

  function handleReset() {
    if (mode === "below") setCalc1({ valuePerSqm: 0, totalDebt: 0, commissionPct: 0, notaryFee: 1000, manualOffer: null });
    else setCalc2({ valuePerSqm: 0, totalDebt: 0, creditor1: 0, creditor2: 0, creditor3: 0, ownerCoefficient: 0.025, commissionPct: 0, notaryFee: 1000, manualOffer: null });
  }

  return e("div", null,
    e("div", { style: { marginBottom: "24px" } },
      e("p", { className: "lk-eyebrow" }, "Narzędzia"),
      e("h1", { className: "lk-heading", style: { marginTop: "4px" } }, "Kalkulator"),
      e("p", { className: "lk-sub" }, "Szybkie przeliczenie opłacalności nieruchomości")
    ),
    e("div", { className: "lk-toggle-wrap" },
      e("button", { className: "lk-toggle-btn " + (mode === "below" ? "active" : ""), onClick: function() { setMode("below"); } }, "Poniżej wartości"),
      e("button", { className: "lk-toggle-btn " + (mode === "above" ? "active" : ""), onClick: function() { setMode("above"); } }, "Powyżej wartości")
    ),
    e("div", { className: "lk-card" },
      mode === "below"
        ? e(Calc1, { input: calc1, onChange: onChange1 })
        : e(Calc2, { input: calc2, onChange: onChange2 })
    ),
    e("div", { style: { marginTop: "16px" } },
      e("button", { className: "lk-btn lk-btn-outline", onClick: handleReset }, "Wyczyść")
    )
  );
};
