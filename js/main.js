(function () {
  "use strict";

  // Sticky header shrink/shadow on scroll
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  var scrim = document.querySelector(".nav-scrim");

  function closeAllNavDropdowns() {
    document.querySelectorAll(".nav-dropdown.is-open").forEach(function (dropdown) {
      dropdown.classList.remove("is-open");
      var t = dropdown.querySelector(".nav-dropdown-trigger");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
    if (scrim) scrim.classList.remove("is-open");
    closeAllNavDropdowns();
  }

  function toggleNav() {
    if (!nav || !toggle) return;
    var isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);
    if (scrim) scrim.classList.toggle("is-open", isOpen);
  }

  if (toggle) toggle.addEventListener("click", toggleNav);
  if (scrim) scrim.addEventListener("click", closeNav);
  if (nav) {
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });

  // "Useful Tools" nav dropdown -- click/tap to toggle (not hover-only, so it
  // works the same on touch and desktop), closes on an outside click or Escape.
  document.querySelectorAll(".nav-dropdown").forEach(function (dropdown) {
    var trigger = dropdown.querySelector(".nav-dropdown-trigger");
    if (!trigger) return;
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.contains("is-open");
      closeAllNavDropdowns();
      if (!isOpen) {
        dropdown.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-dropdown")) closeAllNavDropdowns();
  });

  // Scroll-reveal animation
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // FAQ accordion
  document.querySelectorAll(".accordion-item").forEach(function (item) {
    var trigger = item.querySelector(".accordion-trigger");
    var panel = item.querySelector(".accordion-panel");
    if (!trigger || !panel) return;

    trigger.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");

      document.querySelectorAll(".accordion-item.is-open").forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove("is-open");
          openItem.querySelector(".accordion-trigger").setAttribute("aria-expanded", "false");
          openItem.querySelector(".accordion-panel").style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        panel.style.maxHeight = null;
      } else {
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  });

  // Footer year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Local crisis resource finder
  var crisisForm = document.getElementById("crisis-finder-form");
  if (crisisForm) {
    crisisForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("crisis-zip");
      var location = input.value.trim();
      if (!location) return;
      var query = "suicide and crisis hotlines and facilities near my zipcode of " + location;
      var url = "https://www.google.com/search?q=" + encodeURIComponent(query);
      window.open(url, "_blank", "noopener");
    });
  }
})();
