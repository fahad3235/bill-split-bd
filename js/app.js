/* Bill Split BD — engine, rendering, i18n wiring, persistence.
   No dependencies, no network. State persisted to localStorage ("bill-split-bd"). */
"use strict";

/* ---------------- state ---------------- */
var state = {
  lang: "en",
  bill: 0,
  svcOn: true, svcPct: 10,
  vatOn: true, vatPct: 15,
  people: [],            // {id, name, mode: "equal"|"fixed"|"percent", value}
  rounding: "exact"      // "exact" | "10" | "50"
};
var nextId = 1;

function t(key, vars) {
  var s = (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
  if (vars) for (var k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
}

/* Indian/lakh grouping: 1,00,000.00 */
function fmtBDT(n) {
  var neg = n < 0, abs = Math.abs(n);
  var rounded = Math.round(abs * 100) / 100;
  var parts = rounded.toFixed(2).split(".");
  var intPart = parts[0], last3 = intPart.slice(-3), rest = intPart.slice(0, -3);
  if (rest) last3 = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  return (neg ? "-৳" : "৳") + last3 + "." + parts[1];
}

/* Parse a money-ish input to a non-negative float; NaN -> 0 */
function num(id) {
  var v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? 0 : v;
}

/* =====================================================================
 * THE SPLIT — all split math in ONE function.
 *
 * Inputs:  bill (subtotal), service-charge % (on subtotal),
 *          VAT % (on subtotal + service — BD restaurant standard),
 *          people [{mode, value}], rounding mode.
 *
 * Steps:
 *  1. grand = subtotal + service% of subtotal + VAT% of (subtotal+service).
 *  2. "fixed" people take value taka of the subtotal; "percent" people take
 *     value% of the subtotal; "equal" people share whatever is left, evenly.
 *  3. The service+VAT charges are distributed across people proportionally
 *     to each person's base share of the subtotal.
 *  4. Each person's raw total is rounded per the rounding mode; the sum of
 *     rounded totals minus grand is reported as roundingDiff (honest
 *     over/under collection, never silently dropped).
 *
 * Returns: { service, vat, grand, remaining, pctSum, rows:[{base, charges, raw,
 *            total}], splitTotal, roundingDiff, unallocated }
 * ===================================================================== */
function computeSplit(bill, svcOn, svcPct, vatOn, vatPct, people, rounding) {
  var service = svcOn ? bill * Math.max(0, svcPct) / 100 : 0;
  var vat = vatOn ? (bill + service) * Math.max(0, vatPct) / 100 : 0;
  var grand = bill + service + vat;

  var fixedSum = 0, pctSum = 0, equalCount = 0, i, p;
  for (i = 0; i < people.length; i++) {
    p = people[i];
    if (p.mode === "fixed") fixedSum += Math.max(0, p.value);
    else if (p.mode === "percent") pctSum += Math.max(0, p.value);
    else equalCount++;
  }
  var pctBase = bill * pctSum / 100;
  var remaining = bill - fixedSum - pctBase;                 // left for equals
  var equalShare = equalCount > 0 ? remaining / equalCount : 0;
  var unallocated = equalCount === 0 ? Math.max(0, remaining) : 0;

  var chargeTotal = service + vat;
  var rows = [], splitTotal = 0;
  for (i = 0; i < people.length; i++) {
    p = people[i];
    var base = p.mode === "fixed" ? Math.max(0, p.value)
             : p.mode === "percent" ? bill * Math.max(0, p.value) / 100
             : Math.max(0, equalShare);
    // charges follow the base share proportionally
    var charges = bill > 0 ? base / bill * chargeTotal : 0;
    var raw = base + charges;
    var total = rounding === "10" ? Math.round(raw / 10) * 10
              : rounding === "50" ? Math.round(raw / 50) * 50
              : Math.round(raw * 100) / 100;
    rows.push({ id: p.id, base: base, charges: charges, raw: raw, total: total });
    splitTotal += total;
  }
  var roundingDiff = splitTotal - grand;
  return {
    service: service, vat: vat, grand: grand,
    remaining: remaining, pctSum: pctSum, unallocated: unallocated,
    rows: rows, splitTotal: splitTotal, roundingDiff: roundingDiff
  };
}

/* ---------------- validation ---------------- */
function validate(r) {
  if (!(state.bill > 0)) return t("errBill");
  if (state.people.length === 0) return t("errNoPeople");
  if (r.pctSum > 100) return t("errPct", { p: r.pctSum });
  if (r.remaining < -0.005) return t("errOver", { d: fmtBDT(-r.remaining) });
  return null;
}

/* ---------------- rendering ---------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function render() {
  var r = computeSplit(state.bill, state.svcOn, state.svcPct, state.vatOn,
                       state.vatPct, state.people, state.rounding);
  var err = validate(r);

  /* bill card */
  document.getElementById("tSubtotal").textContent = fmtBDT(state.bill);
  document.getElementById("rowSvc").style.display = state.svcOn ? "" : "none";
  document.getElementById("rowVat").style.display = state.vatOn ? "" : "none";
  document.getElementById("tSvcPct").textContent = state.svcPct;
  document.getElementById("tVatPct").textContent = state.vatPct;
  document.getElementById("tService").textContent = fmtBDT(r.service);
  document.getElementById("tVat").textContent = fmtBDT(r.vat);
  document.getElementById("tGrand").textContent = fmtBDT(r.grand);

  /* people rows */
  var list = document.getElementById("peopleList");
  list.innerHTML = state.people.map(function (p) {
    var valHtml = p.mode === "equal" ? "" :
      '<input type="number" class="pval" data-id="' + p.id + '" value="' + p.value +
      '" min="0" step="0.01" inputmode="decimal" ' +
      (p.mode === "percent" ? 'max="100"' : "") +
      ' aria-label="' + esc(p.mode === "fixed" ? t("amountLabel") : t("percentLabel")) + '">';
    return '<div class="person-row" data-id="' + p.id + '">' +
      '<span class="pname">' + esc(p.name) + '</span>' +
      '<select class="pmode" data-id="' + p.id + '" aria-label="share mode">' +
      '<option value="equal"' + (p.mode === "equal" ? " selected" : "") + '>' + t("modeEqual") + '</option>' +
      '<option value="fixed"' + (p.mode === "fixed" ? " selected" : "") + '>' + t("modeFixed") + '</option>' +
      '<option value="percent"' + (p.mode === "percent" ? " selected" : "") + '>' + t("modePercent") + '</option>' +
      '</select>' + valHtml +
      '<button class="rm-btn" data-id="' + p.id + '" data-testid="rm-' + p.id + '">' + t("remove") + '</button>' +
      '</div>';
  }).join("");

  /* remaining + errors */
  document.getElementById("remainingVal").textContent = fmtBDT(r.remaining);
  var eb = document.getElementById("errorBox");
  if (err) { eb.textContent = err; eb.hidden = false; }
  else { eb.hidden = true; eb.textContent = ""; }

  /* rounding diff */
  var rd = document.getElementById("roundDiff");
  if (state.rounding === "exact" || Math.abs(r.roundingDiff) < 0.005) {
    rd.textContent = t("roundDiffNone");
  } else {
    rd.textContent = t(r.roundingDiff > 0 ? "roundDiffOver" : "roundDiffUnder",
                       { d: fmtBDT(Math.abs(r.roundingDiff)) });
  }

  /* result */
  var empty = document.getElementById("emptyState");
  var rlist = document.getElementById("resultList");
  var rsum = document.getElementById("resultSummary");
  if (err) {
    empty.hidden = false; rlist.hidden = true; rsum.hidden = true;
  } else {
    empty.hidden = true; rlist.hidden = false; rsum.hidden = false;
    var byId = {};
    state.people.forEach(function (p) { byId[p.id] = p; });
    rlist.innerHTML = r.rows.map(function (row) {
      var p = byId[row.id];
      return '<div class="result-row" data-testid="result-row" data-name="' + esc(p.name) + '">' +
        '<span class="rname">' + esc(p.name) + '</span>' +
        '<span class="rbreak">' + fmtBDT(row.base) +
        ' <span class="dim">(' + t("perPersonBase") + ')</span> + ' +
        fmtBDT(row.charges) + ' <span class="dim">(' + t("perPersonCharges") + ')</span></span>' +
        '<b class="rtotal" data-testid="rtotal-' + row.id + '">' + fmtBDT(row.total) + '</b>' +
        '</div>';
    }).join("");
    document.getElementById("rTotal").textContent = fmtBDT(r.splitTotal);
    document.getElementById("rGrand").textContent = fmtBDT(r.grand);
  }

  if (r.unallocated > 0.005 && !err) {
    document.getElementById("remainingVal").textContent =
      fmtBDT(r.remaining) + " — " + t("unallocated", { d: fmtBDT(r.unallocated) });
  }
  save();
}

/* ---------------- events ---------------- */
document.getElementById("billInput").addEventListener("input", function (e) {
  state.bill = parseFloat(e.target.value) || 0; render();
});
document.getElementById("svcOn").addEventListener("change", function (e) {
  state.svcOn = e.target.checked; render();
});
document.getElementById("svcPct").addEventListener("input", function (e) {
  state.svcPct = parseFloat(e.target.value) || 0; render();
});
document.getElementById("vatOn").addEventListener("change", function (e) {
  state.vatOn = e.target.checked; render();
});
document.getElementById("vatPct").addEventListener("input", function (e) {
  state.vatPct = parseFloat(e.target.value) || 0; render();
});
document.querySelectorAll('input[name="rounding"]').forEach(function (el) {
  el.addEventListener("change", function (e) { state.rounding = e.target.value; render(); });
});
document.getElementById("addPersonForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var inp = document.getElementById("nameInput");
  var name = inp.value.trim();
  var eb = document.getElementById("errorBox");
  if (!name) { eb.textContent = t("errEmptyName"); eb.hidden = false; return; }
  if (state.people.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })) {
    eb.textContent = t("errDupName"); eb.hidden = false; return;
  }
  state.people.push({ id: nextId++, name: name, mode: "equal", value: 0 });
  inp.value = ""; render();
});
/* delegated: mode select, value input, remove button */
document.getElementById("peopleList").addEventListener("change", function (e) {
  var id = +e.target.getAttribute("data-id");
  var p = state.people.find(function (x) { return x.id === id; });
  if (!p) return;
  if (e.target.classList.contains("pmode")) { p.mode = e.target.value; if (p.mode === "equal") p.value = 0; }
  else if (e.target.classList.contains("pval")) { p.value = parseFloat(e.target.value) || 0; }
  render();
});
/* live value typing: debounced re-render, focus restored so typing is not interrupted */
var renderTimer = null, focusId = null;
document.getElementById("peopleList").addEventListener("input", function (e) {
  if (!e.target.classList.contains("pval")) return;
  var id = +e.target.getAttribute("data-id");
  var p = state.people.find(function (x) { return x.id === id; });
  if (!p) return;
  p.value = parseFloat(e.target.value) || 0;
  focusId = id;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(function () {
    render();
    var el = document.querySelector('.pval[data-id="' + focusId + '"]');
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) {} }
  }, 400);
});
document.getElementById("peopleList").addEventListener("click", function (e) {
  if (!e.target.classList.contains("rm-btn")) return;
  var id = +e.target.getAttribute("data-id");
  state.people = state.people.filter(function (x) { return x.id !== id; });
  render();
});
document.getElementById("langToggle").addEventListener("click", function () {
  state.lang = state.lang === "en" ? "bn" : "en";
  applyI18n(); render();
});

/* ---------------- i18n apply ---------------- */
function applyI18n() {
  document.documentElement.lang = state.lang === "bn" ? "bn" : "en";
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
    el.placeholder = t(el.getAttribute("data-i18n-ph"));
  });
  document.getElementById("langToggle").textContent = state.lang === "en" ? "বাংলা" : "English";
}

/* ---------------- persistence ---------------- */
function save() {
  try { localStorage.setItem("bill-split-bd", JSON.stringify({ state: state, nextId: nextId })); } catch (e) {}
}
function load() {
  try {
    var raw = localStorage.getItem("bill-split-bd");
    if (!raw) return;
    var d = JSON.parse(raw);
    if (d && d.state && typeof d.state === "object") {
      Object.keys(state).forEach(function (k) {
        if (k in d.state) state[k] = d.state[k];
      });
      if (Array.isArray(state.people)) nextId = d.nextId || (state.people.length + 1);
      else state.people = [];
    }
  } catch (e) {}
}

/* ---------------- init ---------------- */
load();
document.getElementById("billInput").value = state.bill || "";
document.getElementById("svcOn").checked = state.svcOn;
document.getElementById("svcPct").value = state.svcPct;
document.getElementById("vatOn").checked = state.vatOn;
document.getElementById("vatPct").value = state.vatPct;
document.querySelector('input[name="rounding"][value="' + state.rounding + '"]').checked = true;
applyI18n();
render();
