/* UnderstandMe -- provider profile (shared by every page).
 *
 * There is no server and no patient data anywhere in this site. A "provider
 * account" is just a small profile -- name, practice, contact -- that brands
 * the take-away print sheets. It reaches a page one of two ways:
 *
 *   1. Saved on this device by the provider (localStorage, opt-in), or
 *   2. Carried in an assignment link (?p=...) the provider sends a patient.
 *      The link holds only the provider's own details, never anything the
 *      patient types, and a patient's browser does not store it.
 *
 * This module is the seam for real accounts later: swap load()/save() for
 * calls to an auth backend and nothing else has to change.
 */
var UM = (function () {
  "use strict";

  var KEY = "um_provider";
  var FIELDS = ["name", "credentials", "practice", "email", "phone", "note"];
  var LIMITS = { name: 80, credentials: 60, practice: 100, email: 120, phone: 40, note: 280 };

  function clean(raw) {
    var out = {};
    FIELDS.forEach(function (f) {
      var v = raw && typeof raw[f] === "string" ? raw[f] : "";
      out[f] = v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, LIMITS[f]);
    });
    return out;
  }

  function encode(profile) {
    var json = JSON.stringify(clean(profile));
    var bytes = new TextEncoder().encode(json);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decode(str) {
    try {
      var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return clean(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (e) {
      return null;
    }
  }

  function readDevice() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? clean(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  var source = "none";
  var profile = clean({});

  (function init() {
    try {
      var p = new URLSearchParams(window.location.search).get("p");
      if (p) {
        var fromLink = decode(p);
        if (fromLink) { profile = fromLink; source = "link"; return; }
      }
    } catch (e) { /* fall through */ }
    var saved = readDevice();
    if (saved) { profile = saved; source = "device"; }
  })();

  function save(next) {
    profile = clean(next);
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { return false; }
    if (source !== "link") source = "device";
    return true;
  }

  function forget() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    if (source === "device") { profile = clean({}); source = "none"; }
  }

  function hasProfile() {
    return !!(profile.name || profile.practice);
  }

  /* "Practice -- Name, Credentials"; falls back to the product name. */
  function letterheadName() {
    var person = profile.name + (profile.credentials ? ", " + profile.credentials : "");
    var parts = [profile.practice, person.trim()].filter(Boolean);
    return parts.length ? parts.join(" — ") : "UnderstandMe";
  }

  function letterheadContact() {
    return [profile.email, profile.phone].filter(Boolean).join(" · ");
  }

  /* One-line version for tools that build the string themselves. */
  function letterheadLine() {
    var c = letterheadContact();
    return c ? letterheadName() + " — " + c : letterheadName();
  }

  function fillLetterheads() {
    var els = document.querySelectorAll("[data-um-letterhead]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      while (el.firstChild) el.removeChild(el.firstChild);
      var strong = document.createElement("strong");
      strong.textContent = letterheadName();
      el.appendChild(strong);
      var contact = letterheadContact();
      if (contact) {
        el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(contact));
      }
    }
  }

  function fillMailto() {
    var els = document.querySelectorAll("[data-um-provider-mailto]");
    for (var i = 0; i < els.length; i++) {
      if (profile.email) {
        els[i].setAttribute("href", "mailto:" + encodeURIComponent(profile.email).replace(/%40/g, "@"));
        els[i].hidden = false;
      } else {
        els[i].hidden = true;
      }
    }
  }

  function fillBanner() {
    var el = document.getElementById("um-provider-banner");
    if (!el) return;
    if (source !== "link" || !hasProfile()) { el.hidden = true; return; }
    var who = letterheadName();
    el.textContent = "";
    var strong = document.createElement("strong");
    strong.textContent = who;
    el.appendChild(document.createTextNode("Shared with you by "));
    el.appendChild(strong);
    if (profile.note) el.appendChild(document.createTextNode(" — “" + profile.note + "”"));
    el.hidden = false;
  }

  /* Keep the provider's branding and the packet order when someone moves
     between tool pages. Only tool/home/packet links are touched. */
  var CARRY = ["p", "flow"];
  var CARRY_TARGET = /^(index|packet|values-sort|avoidance-calculator|suds-tracker|wheel-of-life|decision-matrix|genogram|step-builder|week-builder)\.html(#.*)?$/i;

  function carryQuery() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return ""; }
    var out = [];
    CARRY.forEach(function (k) {
      var v = params.get(k);
      if (v) out.push(k + "=" + encodeURIComponent(v).replace(/%2C/g, ","));
    });
    return out.length ? "?" + out.join("&") : "";
  }

  function carryHref(href) {
    var q = carryQuery();
    if (!q || !CARRY_TARGET.test(href)) return href;
    var parts = href.split("#");
    return parts[0] + q + (parts[1] ? "#" + parts[1] : "");
  }

  function carryLinks() {
    if (!carryQuery()) return;
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (href.indexOf("?") === -1) links[i].setAttribute("href", carryHref(href));
    }
  }

  function toolUrl(file, extra) {
    var base = window.location.href.replace(/[?#].*$/, "").replace(/[^\/]*$/, "");
    var q = hasProfile() ? "?p=" + encode(profile) : "";
    return base + file + q + (extra || "");
  }

  function markActiveNav() {
    var m = window.location.pathname.match(/([^\/]+\.html)$/);
    var page = m ? m[1] : "index.html";
    var links = document.querySelectorAll(".main-nav > a");
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute("href").split("?")[0].split("#")[0];
      if (h === page) links[i].setAttribute("aria-current", "page");
    }
  }

  function onReady() {
    fillLetterheads();
    fillBanner();
    fillMailto();
    carryLinks();
    markActiveNav();
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();

  return {
    get profile() { return profile; },
    get source() { return source; },
    FIELDS: FIELDS, LIMITS: LIMITS,
    clean: clean, encode: encode, decode: decode,
    save: save, forget: forget, hasProfile: hasProfile, toolUrl: toolUrl,
    letterheadName: letterheadName, letterheadContact: letterheadContact, letterheadLine: letterheadLine,
    carryHref: carryHref, carryQuery: carryQuery, carryLinks: carryLinks,
    refresh: onReady
  };
})();
